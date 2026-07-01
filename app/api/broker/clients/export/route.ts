import { NextResponse } from "next/server";
import JSZip from "jszip";
import {
  brokerClientDisplayName,
  brokerClientStatusLabels,
  insuranceTypeLabel,
} from "@/lib/broker/clients";
import { contractDisplayLabel } from "@/lib/broker/contracts";
import { BROKER_FILES_BUCKET, sanitizeFileName } from "@/lib/broker/documents";
import { formatEuro } from "@/lib/broker/commissions";
import { requireBrokerApiContext } from "@/lib/broker/server";
import {
  getOutlookAccessForUser,
  searchMessagesByParticipant,
} from "@/lib/email/outlook-read";
import { formatDate, formatDateTime } from "@/lib/format";
import type {
  BrokerClaimRow,
  BrokerClientRow,
  BrokerCommissionRow,
  BrokerComplianceRow,
  BrokerContractRow,
  BrokerDocumentRow,
  BrokerQuoteRow,
} from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

function line(label: string, value: unknown): string {
  const v =
    value === null || value === undefined || value === ""
      ? "—"
      : String(value);
  return `${label} : ${v}`;
}

/** Groups rows by their client_id into a Map (rows without a client are skipped). */
function groupBy<T extends { client_id: string | null }>(
  rows: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.client_id) continue;
    const list = map.get(row.client_id) ?? [];
    list.push(row);
    map.set(row.client_id, list);
  }
  return map;
}

function buildClientInfo(
  client: BrokerClientRow,
  contracts: BrokerContractRow[],
  quotes: BrokerQuoteRow[],
  claims: BrokerClaimRow[],
  commissions: BrokerCommissionRow[],
  compliance: BrokerComplianceRow | undefined,
): string {
  const name = brokerClientDisplayName(client);
  const parts: string[] = [];

  parts.push(`FICHE CLIENT — ${name}`);
  parts.push("=".repeat(48));
  parts.push("");
  parts.push("IDENTITÉ");
  parts.push(
    line(
      "Type",
      client.client_type === "company" ? "Entreprise" : "Particulier",
    ),
  );
  parts.push(line("Prénom", client.first_name));
  parts.push(line("Nom", client.last_name));
  parts.push(line("Société", client.company_name));
  parts.push(line("Date de naissance", client.date_of_birth));
  parts.push("");
  parts.push("CONTACT");
  parts.push(line("Email", client.email));
  parts.push(line("Téléphone", client.phone));
  parts.push(line("Adresse", client.address));
  parts.push(line("Code postal", client.postal_code));
  parts.push(line("Ville", client.city));
  parts.push("");
  parts.push("DOSSIER");
  parts.push(line("Branche", insuranceTypeLabel(client.insurance_type)));
  parts.push(
    line(
      "Statut",
      brokerClientStatusLabels[
        client.status as keyof typeof brokerClientStatusLabels
      ] ?? client.status,
    ),
  );
  parts.push(line("Créé le", formatDate(client.created_at)));
  parts.push(line("Mis à jour le", formatDate(client.updated_at)));
  parts.push("");
  parts.push("BESOINS");
  parts.push(client.needs?.trim() || "—");
  if (
    client.structured_needs &&
    Object.keys(client.structured_needs).length > 0
  ) {
    parts.push("");
    parts.push("BESOINS STRUCTURÉS");
    for (const [k, v] of Object.entries(client.structured_needs)) {
      parts.push(line(k, v));
    }
  }
  if (client.notes?.trim()) {
    parts.push("");
    parts.push("NOTES");
    parts.push(client.notes.trim());
  }

  if (contracts.length > 0) {
    parts.push("");
    parts.push(`CONTRATS (${contracts.length})`);
    for (const c of contracts) {
      parts.push(
        `- ${contractDisplayLabel(c)} · ${c.status} · échéance ${
          c.renewal_date ? formatDate(c.renewal_date) : "—"
        }`,
      );
    }
  }

  if (quotes.length > 0) {
    parts.push("");
    parts.push(`DEVIS (${quotes.length})`);
    for (const q of quotes) {
      parts.push(
        `- ${q.insurer_name || "Devis"}${
          q.product_name ? ` — ${q.product_name}` : ""
        } · ${q.extraction_status}`,
      );
    }
  }

  if (claims.length > 0) {
    parts.push("");
    parts.push(`SINISTRES (${claims.length})`);
    for (const cl of claims) {
      parts.push(
        `- ${cl.claim_type || "Sinistre"} · ${cl.status}${
          cl.declaration_date ? ` · ${formatDate(cl.declaration_date)}` : ""
        }`,
      );
    }
  }

  if (commissions.length > 0) {
    parts.push("");
    parts.push(`COMMISSIONS (${commissions.length})`);
    for (const cm of commissions) {
      parts.push(
        `- ${cm.label || cm.insurer_name || "Commission"} · ${formatEuro(
          cm.commission_amount,
          cm.currency,
        )} · ${cm.status}`,
      );
    }
  }

  if (compliance) {
    parts.push("");
    parts.push("CONFORMITÉ (LCB-FT / RGPD)");
    parts.push(
      line("Identité vérifiée", compliance.identity_verified ? "Oui" : "Non"),
    );
    parts.push(line("Niveau de risque", compliance.risk_level));
    parts.push(line("PEP", compliance.is_pep ? "Oui" : "Non"));
    parts.push(line("Origine des fonds", compliance.funds_origin));
    parts.push(
      line(
        "Consentement traitement des données",
        compliance.consent_data_processing ? "Oui" : "Non",
      ),
    );
    parts.push(
      line(
        "Fiche d'information remise",
        compliance.info_sheet_delivered ? "Oui" : "Non",
      ),
    );
  }

  parts.push("");
  parts.push(`Exporté le ${formatDateTime(new Date().toISOString())}`);
  return parts.join("\n");
}

/**
 * Exports every (non-archived) client dossier of the organization as a single
 * ZIP: one folder per client with an info sheet, all stored attachments, and —
 * best-effort — the emails exchanged with the client (from the connected Outlook
 * mailbox). Manager-only: bundles all client data of the workspace.
 */
export async function GET() {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (auth.context.membership?.role !== "manager") {
    return jsonError(
      "Seul un gestionnaire peut exporter les dossiers.",
      403,
      "insufficient_role",
    );
  }

  const admin = auth.adminSupabase;
  const orgId = auth.organizationId;

  const { data: clientRows } = await admin
    .from("broker_clients")
    .select("*")
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  const clients = (clientRows ?? []) as BrokerClientRow[];
  if (clients.length === 0) {
    return jsonError("Aucun dossier à exporter.", 404, "no_clients");
  }

  // Bulk-load related rows once, then group by client in memory.
  const [
    { data: docRows },
    { data: contractRows },
    { data: quoteRows },
    { data: claimRows },
    { data: commissionRows },
    { data: complianceRows },
  ] = await Promise.all([
    admin.from("broker_documents").select("*").eq("organization_id", orgId),
    admin.from("broker_contracts").select("*").eq("organization_id", orgId),
    admin.from("broker_quotes").select("*").eq("organization_id", orgId),
    admin.from("broker_claims").select("*").eq("organization_id", orgId),
    admin.from("broker_commissions").select("*").eq("organization_id", orgId),
    admin.from("broker_compliance").select("*").eq("organization_id", orgId),
  ]);

  const documentsByClient = groupBy((docRows ?? []) as BrokerDocumentRow[]);
  const contractsByClient = groupBy((contractRows ?? []) as BrokerContractRow[]);
  const quotesByClient = groupBy((quoteRows ?? []) as BrokerQuoteRow[]);
  const claimsByClient = groupBy((claimRows ?? []) as BrokerClaimRow[]);
  const commissionsByClient = groupBy(
    (commissionRows ?? []) as BrokerCommissionRow[],
  );
  const complianceByClient = new Map<string, BrokerComplianceRow>();
  for (const c of (complianceRows ?? []) as BrokerComplianceRow[]) {
    complianceByClient.set(c.client_id, c);
  }

  // Outlook access is optional — emails are exported best-effort.
  const access = await getOutlookAccessForUser(orgId, auth.user.id);

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const client of clients) {
    const displayName = brokerClientDisplayName(client);
    let folderName = sanitizeFileName(displayName) || "dossier";
    // Guarantee uniqueness across clients with the same name.
    if (usedNames.has(folderName)) folderName = `${folderName}-${client.id.slice(0, 8)}`;
    usedNames.add(folderName);
    const folder = zip.folder(folderName)!;

    const contracts = contractsByClient.get(client.id) ?? [];
    const quotes = quotesByClient.get(client.id) ?? [];
    const claims = claimsByClient.get(client.id) ?? [];
    const commissions = commissionsByClient.get(client.id) ?? [];
    const compliance = complianceByClient.get(client.id);

    folder.file(
      "informations.txt",
      buildClientInfo(client, contracts, quotes, claims, commissions, compliance),
    );

    // Attachments — download each stored document.
    const documents = documentsByClient.get(client.id) ?? [];
    if (documents.length > 0) {
      const docFolder = folder.folder("pieces-jointes")!;
      const seen = new Set<string>();
      for (const doc of documents) {
        if (!doc.storage_path) continue;
        try {
          const { data, error } = await admin.storage
            .from(BROKER_FILES_BUCKET)
            .download(doc.storage_path);
          if (error || !data) continue;
          let fileName = sanitizeFileName(doc.file_name || doc.title || "piece");
          if (seen.has(fileName)) fileName = `${doc.id.slice(0, 8)}-${fileName}`;
          seen.add(fileName);
          const buffer = Buffer.from(await data.arrayBuffer());
          docFolder.file(fileName, buffer);
        } catch (err) {
          console.error("[export] document download failed:", err);
        }
      }
    }

    // Emails — best-effort from the connected Outlook mailbox.
    if (access && client.email) {
      try {
        const messages = await searchMessagesByParticipant(
          access.accessToken,
          client.email,
        );
        if (messages.length > 0) {
          const text = messages
            .map((m) =>
              [
                `De     : ${m.fromName || m.fromEmail} <${m.fromEmail}>`,
                `Objet  : ${m.subject}`,
                `Reçu   : ${
                  m.receivedDateTime ? formatDateTime(m.receivedDateTime) : "—"
                }`,
                m.hasAttachments ? "Pièces jointes : oui" : "",
                "",
                m.bodyPreview,
                "",
                "-".repeat(48),
                "",
              ]
                .filter(Boolean)
                .join("\n"),
            )
            .join("\n");
          folder.file(
            "emails.txt",
            `EMAILS ÉCHANGÉS AVEC ${displayName} (${client.email})\n${"=".repeat(48)}\n\n${text}`,
          );
        }
      } catch (err) {
        console.error("[export] email fetch failed:", err);
      }
    }
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="dossiers-clients-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
