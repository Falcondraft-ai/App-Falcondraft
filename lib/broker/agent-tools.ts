import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { brokerAdviceStatusLabels } from "@/lib/broker/advice";
import { generateAdviceContent } from "@/lib/broker/advice-ai";
import { buildAdviceJustificationDraft } from "@/lib/broker/advice-document";
import {
  brokerClientDisplayName,
  brokerClientStatusLabels,
  brokerInsuranceTypes,
  insuranceTypeLabel,
  isBrokerClientStatus,
} from "@/lib/broker/clients";
import {
  brokerClaimStatusLabels,
  claimDisplayLabel,
  isBrokerClaimStatus,
} from "@/lib/broker/claims";
import { formatEuro, sumCommissions } from "@/lib/broker/commissions";
import {
  brokerContractStatusLabels,
  contractDisplayLabel,
  daysUntil,
  formatContractPremium,
  isBrokerContractStatus,
  RENEWAL_HORIZON_DAYS,
} from "@/lib/broker/contracts";
import {
  BROKER_FILES_BUCKET,
  documentCategoryLabel,
  sanitizeFileName,
} from "@/lib/broker/documents";
import {
  isReadableDocument,
  understandDocument,
} from "@/lib/broker/document-understanding";
import {
  brokerQuoteStatusLabels,
  formatPremium,
} from "@/lib/broker/quotes";
import {
  adjustOrganizationStorage,
  logBrokerActivity,
} from "@/lib/broker/server";
import { computeStorageUsage, formatBytes } from "@/lib/broker/storage";
import { createOutlookDraft } from "@/lib/email/outlook-drafts";
import {
  companyEmailDomain,
  getFileAttachmentBytes,
  getMessageAttachmentsMeta,
  getOutlookAccessForUser,
  getOutlookMessageBody,
  listRecentInboxMessages,
  searchMessagesForClient,
  type ClientSearchCriteria,
} from "@/lib/email/outlook-read";
import type {
  BrokerClaimRow,
  BrokerClientRow,
  BrokerContractRow,
  BrokerQuoteRow,
  Database,
  OrganizationRow,
} from "@/types/database";

/** A file the user attached in the chat, staged in Storage, ready to be filed. */
export type PendingUpload = {
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type AgentToolContext = {
  adminSupabase: SupabaseClient<Database>;
  organization: OrganizationRow;
  userId: string;
  canWrite: boolean;
  /** Files attached to the current user turn, keyed by upload_id. */
  pendingUploads?: Map<string, PendingUpload>;
};

/** Anthropic tool definitions exposed to the agent. */
export const agentToolDefinitions = [
  {
    name: "list_clients",
    description:
      "Liste les dossiers clients du cabinet. Filtrable par statut (new, in_progress, advice_ready, awaiting_signature, signed, closed, lost) et recherche texte.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string" },
        search: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_client",
    description:
      "Vue complète d'un dossier : informations, notes internes, contrats, documents, devis compagnies, devoirs de conseil, historique. Toujours utiliser avant de détailler un dossier ou d'agir dessus.",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
  },
  {
    name: "list_client_emails",
    description:
      "Retrouve les emails de la boîte Outlook qui CONCERNENT un dossier client : échanges avec le client, mais aussi emails d'assureurs ou de tiers qui citent son nom, son entreprise ou une référence de contrat/sinistre. À utiliser pour reconstituer l'historique ou le contexte d'un dossier (« où en est-on avec ce client ? »). Paramètre optionnel query (texte libre) pour affiner. Les message_id renvoyés s'utilisent avec read_email / list_email_attachments.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        query: { type: "string" },
      },
      required: ["client_id"],
    },
  },
  {
    name: "get_stats",
    description:
      "Indicateurs du cabinet : nombre de dossiers par statut, total, espace de stockage utilisé.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_recent_activity",
    description: "Dernières actions sur l'ensemble des dossiers.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number" } },
    },
  },
  {
    name: "find_client_by_email",
    description:
      "Retrouve un dossier client existant à partir d'une adresse email (ex. l'expéditeur d'un email reçu). Sert à reconnaître un client déjà connu avant d'agir.",
    input_schema: {
      type: "object",
      properties: { email: { type: "string" } },
      required: ["email"],
    },
  },
  {
    name: "list_contracts",
    description:
      "Liste les contrats d'un dossier client : compagnie, produit, n° de police, prime, échéance/renouvellement, statut.",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
  },
  {
    name: "list_email_attachments",
    description:
      "Liste les pièces jointes (fichiers) d'un email Outlook à partir de son message_id (obtenu via list_recent_emails). Renvoie pour chacune un attachment_id à utiliser pour la ranger dans un dossier.",
    input_schema: {
      type: "object",
      properties: { message_id: { type: "string" } },
      required: ["message_id"],
    },
  },
  {
    name: "inspect_email_attachment",
    description:
      "Ouvre et LIT une pièce jointe d'un email Outlook (PDF ou image) pour dire ce que c'est : nature du document (devis, contrat, RIB, pièce d'identité, autre), résumé de son contenu, et personne/entreprise concernée. À utiliser avant de ranger une pièce jointe pour choisir la bonne catégorie, ou quand l'utilisateur demande « c'est quoi cette pièce jointe ». Fournir message_id et attachment_id (via list_email_attachments).",
    input_schema: {
      type: "object",
      properties: {
        message_id: { type: "string" },
        attachment_id: { type: "string" },
      },
      required: ["message_id", "attachment_id"],
    },
  },
  {
    name: "inspect_uploaded_file",
    description:
      "Ouvre et LIT un fichier (PDF ou image) que l'utilisateur a joint dans la conversation, pour dire ce que c'est : nature du document (devis, contrat, RIB, pièce d'identité, autre), résumé de son contenu, et personne/entreprise concernée. À utiliser dès que l'utilisateur joint un document et demande de l'analyser, de dire ce que c'est, ou avant de le ranger pour choisir la bonne catégorie. Fournir upload_id (la référence entre crochets à côté du nom du fichier joint).",
    input_schema: {
      type: "object",
      properties: { upload_id: { type: "string" } },
      required: ["upload_id"],
    },
  },
  {
    name: "get_upcoming_renewals",
    description:
      `Liste les contrats dont l'échéance arrive bientôt ou est dépassée (renouvellements à suivre), triés du plus urgent au moins urgent. Paramètre within_days (défaut ${RENEWAL_HORIZON_DAYS}).`,
    input_schema: {
      type: "object",
      properties: { within_days: { type: "number" } },
    },
  },
  {
    name: "get_commission_summary",
    description:
      "Synthèse des commissions du cabinet : total perçu, total rétrocédé aux apporteurs, net conservé, et nombre de bordereaux restant à pointer.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_open_claims",
    description:
      "Liste les sinistres en cours (déclarés, en instruction ou en attente de pièces) — ceux qui demandent un suivi.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number" } },
    },
  },
  {
    name: "list_recent_emails",
    description:
      "Liste les emails récents de la boîte Outlook connectée du courtier (expéditeur, objet, aperçu, identifiant). Paramètre within_days (défaut 3, max 30). Sert à répondre à « qu'est-ce que j'ai reçu », trouver un email, préparer une réponse.",
    input_schema: {
      type: "object",
      properties: { within_days: { type: "number" } },
    },
  },
  {
    name: "read_email",
    description:
      "Lit le contenu complet d'un email Outlook à partir de son message_id (obtenu via list_recent_emails). Renvoie l'expéditeur, l'objet et le corps. À utiliser avant de résumer un email ou d'en rédiger la réponse.",
    input_schema: {
      type: "object",
      properties: { message_id: { type: "string" } },
      required: ["message_id"],
    },
  },
  {
    name: "draft_email",
    description:
      "Crée un BROUILLON d'email dans la boîte Outlook du courtier — JAMAIS d'envoi automatique. Fournir to (destinataire), subject, body. Le courtier relit et envoie lui-même. À n'utiliser que si l'utilisateur demande de préparer/rédiger un email.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "create_client",
    description:
      "Crée un nouveau dossier client. À n'utiliser que si l'utilisateur le demande explicitement. Le dossier doit être au nom de la personne/entreprise ASSURÉE (celle décrite dans le contenu), pas de l'expéditeur d'un email s'il n'est qu'un intermédiaire. Renseigne email/phone avec les coordonnées du client lui-même. Pour un particulier, fournir au moins last_name ; pour une entreprise, company_name.",
    input_schema: {
      type: "object",
      properties: {
        client_type: { type: "string", enum: ["individual", "company"] },
        first_name: { type: "string" },
        last_name: { type: "string" },
        company_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        insurance_type: {
          type: "string",
          description: "immobilier, personnes, auto, pro ou autre",
        },
        notes: {
          type: "string",
          description:
            "Note interne du dossier : situation du client, objet à assurer et ses caractéristiques, contexte de la demande.",
        },
      },
      required: ["client_type"],
    },
  },
  {
    name: "update_client_status",
    description:
      "Met à jour le statut d'un dossier client. Statuts : new, in_progress, advice_ready, awaiting_signature, signed, closed, lost.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        status: { type: "string" },
      },
      required: ["client_id", "status"],
    },
  },
  {
    name: "update_client",
    description:
      "Met à jour les informations d'un dossier client (coordonnées, branche, notes…). Ne renseigne QUE les champs à modifier. Sert notamment à mettre à jour un client existant à partir d'un email.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        company_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" },
        postal_code: { type: "string" },
        city: { type: "string" },
        insurance_type: {
          type: "string",
          description: "immobilier, personnes, auto, pro ou autre",
        },
        notes: { type: "string" },
      },
      required: ["client_id"],
    },
  },
  {
    name: "attach_email_attachment_to_client",
    description:
      "Range une pièce jointe d'un email Outlook dans les documents d'un dossier client. Fournir client_id, message_id et attachment_id (via list_email_attachments). category optionnelle : company_quote, contract, rib, id_document, other.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        message_id: { type: "string" },
        attachment_id: { type: "string" },
        category: { type: "string" },
      },
      required: ["client_id", "message_id", "attachment_id"],
    },
  },
  {
    name: "attach_uploaded_file_to_client",
    description:
      "Range dans les documents d'un dossier client un fichier fourni par l'utilisateur directement dans la conversation (pièce jointe du chat, ex. un PDF). Fournir client_id et upload_id — l'upload_id est la référence indiquée entre crochets à côté du nom du fichier joint. category optionnelle : company_quote, contract, rib, id_document, other.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        upload_id: { type: "string" },
        category: { type: "string" },
      },
      required: ["client_id", "upload_id"],
    },
  },
  {
    name: "generate_advice",
    description:
      "Génère un brouillon de devoir de conseil pour un dossier : les motifs et les exigences de garantie sont rédigés automatiquement à partir des besoins notés et du dernier devis validé. Renvoie le lien à ouvrir pour le relire, le compléter et le valider.",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
  },
] as const;

type ToolInput = Record<string, unknown>;

function str(input: ToolInput, key: string): string | undefined {
  const v = input[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function num(input: ToolInput, key: string): number | undefined {
  const v = input[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
/** Only the module's fixed branches are stored — anything else is dropped. */
function insuranceTypeOf(input: ToolInput): string | undefined {
  const v = str(input, "insurance_type")?.toLowerCase();
  return v && (brokerInsuranceTypes as readonly string[]).includes(v)
    ? v
    : undefined;
}

const clientSelect = "*";

export async function executeAgentTool(
  name: string,
  input: ToolInput,
  ctx: AgentToolContext,
): Promise<unknown> {
  const { adminSupabase, organization } = ctx;
  const organizationId = organization.id;

  // ---- READ TOOLS ----
  if (name === "list_clients") {
    let query = adminSupabase
      .from("broker_clients")
      .select(clientSelect)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(Math.min(num(input, "limit") ?? 25, 100));

    const status = str(input, "status");
    if (status && isBrokerClientStatus(status)) query = query.eq("status", status);
    const search = str(input, "search");
    if (search) {
      const t = `%${search}%`;
      query = query.or(
        `first_name.ilike.${t},last_name.ilike.${t},company_name.ilike.${t},email.ilike.${t},phone.ilike.${t}`,
      );
    }
    const { data } = await query;
    const clients = (data ?? []) as BrokerClientRow[];
    return {
      count: clients.length,
      clients: clients.map((c) => ({
        id: c.id,
        name: brokerClientDisplayName(c),
        type: c.client_type === "company" ? "entreprise" : "particulier",
        branch: insuranceTypeLabel(c.insurance_type),
        status: brokerClientStatusLabels[isBrokerClientStatus(c.status) ? c.status : "new"],
        email: c.email,
        phone: c.phone,
      })),
    };
  }

  if (name === "get_client") {
    const clientId = str(input, "client_id");
    if (!clientId) return { error: "client_id requis." };
    const { data: client } = await adminSupabase
      .from("broker_clients")
      .select(clientSelect)
      .eq("organization_id", organizationId)
      .eq("id", clientId)
      .maybeSingle();
    if (!client) return { error: "Dossier introuvable." };
    const c = client as BrokerClientRow;

    const [docs, quotes, advice, activity, contractsRes] = await Promise.all([
      adminSupabase.from("broker_documents").select("title, category, size_bytes").eq("organization_id", organizationId).eq("client_id", clientId),
      adminSupabase.from("broker_quotes").select("insurer_name, product_name, premium_monthly, premium_annual, currency, extraction_status").eq("organization_id", organizationId).eq("client_id", clientId),
      adminSupabase.from("broker_advice").select("title, status, updated_at").eq("organization_id", organizationId).eq("client_id", clientId),
      adminSupabase.from("broker_activity").select("type, description, created_at").eq("organization_id", organizationId).eq("client_id", clientId).order("created_at", { ascending: false }).limit(8),
      adminSupabase.from("broker_contracts").select("*").eq("organization_id", organizationId).eq("client_id", clientId).order("renewal_date", { ascending: true }),
    ]);

    return {
      id: c.id,
      name: brokerClientDisplayName(c),
      type: c.client_type,
      status: brokerClientStatusLabels[isBrokerClientStatus(c.status) ? c.status : "new"],
      branch: insuranceTypeLabel(c.insurance_type),
      email: c.email,
      phone: c.phone,
      address: [c.address, c.postal_code, c.city].filter(Boolean).join(", "),
      // Everything the cabinet records about a client lives in the internal
      // notes now (needs is legacy — fold it in for old dossiers).
      notes: [c.notes, c.needs].filter((v) => v?.trim()).join("\n\n") || null,
      link: `/courtier/clients/${c.id}`,
      documents: (docs.data ?? []).map((d) => ({
        title: d.title,
        category: documentCategoryLabel(d.category),
        size: formatBytes(d.size_bytes ?? 0),
      })),
      quotes: (quotes.data ?? []).map((q) => ({
        insurer: q.insurer_name,
        product: q.product_name,
        premium:
          q.premium_monthly != null
            ? `${formatPremium(q.premium_monthly, q.currency)} / mois`
            : q.premium_annual != null
              ? `${formatPremium(q.premium_annual, q.currency)} / an`
              : null,
        status: brokerQuoteStatusLabels[(q.extraction_status as keyof typeof brokerQuoteStatusLabels) ?? "pending"],
      })),
      contracts: ((contractsRes.data ?? []) as BrokerContractRow[]).map((ct) => ({
        label: contractDisplayLabel(ct),
        insurer: ct.insurer_name,
        policy_number: ct.policy_number,
        premium: formatContractPremium(ct),
        renewal_date: ct.renewal_date,
        days_until_renewal: daysUntil(ct.renewal_date),
        tacit_renewal: ct.tacit_renewal,
        status:
          brokerContractStatusLabels[
            isBrokerContractStatus(ct.status) ? ct.status : "active"
          ],
      })),
      advice: (advice.data ?? []).map((a) => ({
        title: a.title,
        status: brokerAdviceStatusLabels[(a.status as keyof typeof brokerAdviceStatusLabels) ?? "draft"],
      })),
      recent_activity: (activity.data ?? []).map((e) => ({
        type: e.type,
        description: e.description,
        at: e.created_at,
      })),
    };
  }

  if (name === "get_stats") {
    const { data } = await adminSupabase
      .from("broker_clients")
      .select("status")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .limit(2000);
    const rows = (data ?? []) as { status: string }[];
    const byStatus: Record<string, number> = {};
    for (const r of rows) {
      const label = brokerClientStatusLabels[isBrokerClientStatus(r.status) ? r.status : "new"];
      byStatus[label] = (byStatus[label] ?? 0) + 1;
    }
    const usage = computeStorageUsage(organization);
    return {
      total_clients: rows.length,
      by_status: byStatus,
      storage: `${formatBytes(usage.usedBytes)} / ${formatBytes(usage.limitBytes)} (${usage.percent}%)`,
    };
  }

  if (name === "get_recent_activity") {
    const { data } = await adminSupabase
      .from("broker_activity")
      .select("type, description, client_id, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(Math.min(num(input, "limit") ?? 15, 50));
    return {
      activity: (data ?? []).map((e) => ({
        type: e.type,
        description: e.description,
        client_link: `/courtier/clients/${e.client_id}`,
        at: e.created_at,
      })),
    };
  }

  if (name === "find_client_by_email") {
    const email = str(input, "email");
    if (!email) return { error: "email requis." };
    const { data } = await adminSupabase
      .from("broker_clients")
      .select(clientSelect)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("email", email)
      .limit(5);
    const clients = (data ?? []) as BrokerClientRow[];
    return {
      count: clients.length,
      clients: clients.map((c) => ({
        id: c.id,
        name: brokerClientDisplayName(c),
        branch: insuranceTypeLabel(c.insurance_type),
        status:
          brokerClientStatusLabels[
            isBrokerClientStatus(c.status) ? c.status : "new"
          ],
        email: c.email,
        phone: c.phone,
        link: `/courtier/clients/${c.id}`,
      })),
    };
  }

  if (name === "list_contracts") {
    const clientId = str(input, "client_id");
    if (!clientId) return { error: "client_id requis." };
    const { data } = await adminSupabase
      .from("broker_contracts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("renewal_date", { ascending: true });
    const contracts = (data ?? []) as BrokerContractRow[];
    return {
      count: contracts.length,
      contracts: contracts.map((c) => ({
        id: c.id,
        label: contractDisplayLabel(c),
        insurer: c.insurer_name,
        product: c.product_name,
        policy_number: c.policy_number,
        premium: formatContractPremium(c),
        renewal_date: c.renewal_date,
        days_until_renewal: daysUntil(c.renewal_date),
        tacit_renewal: c.tacit_renewal,
        status:
          brokerContractStatusLabels[
            isBrokerContractStatus(c.status) ? c.status : "active"
          ],
        link: `/courtier/clients/${c.client_id}/contracts/${c.id}`,
      })),
    };
  }

  if (name === "list_client_emails") {
    const clientId = str(input, "client_id");
    if (!clientId) return { error: "client_id requis." };
    const { data: client } = await adminSupabase
      .from("broker_clients")
      .select(clientSelect)
      .eq("organization_id", organizationId)
      .eq("id", clientId)
      .maybeSingle();
    if (!client) return { error: "Dossier introuvable." };
    const c = client as BrokerClientRow;
    const access = await getOutlookAccessForUser(organizationId, ctx.userId);
    if (!access) return { error: "Boîte Outlook non connectée." };

    // Same signals as the dossier's "Emails" tab: address, name(s), company
    // domain, and contract/claim references — so an insurer's mail that only
    // cites the policy number still surfaces.
    const [contractsRes, claimsRes, linkedRes] = await Promise.all([
      adminSupabase
        .from("broker_contracts")
        .select("policy_number")
        .eq("organization_id", organizationId)
        .eq("client_id", clientId)
        .not("policy_number", "is", null)
        .limit(50),
      adminSupabase
        .from("broker_claims")
        .select("reference")
        .eq("organization_id", organizationId)
        .eq("client_id", clientId)
        .not("reference", "is", null)
        .limit(50),
      adminSupabase
        .from("broker_email_items")
        .select("graph_message_id, from_name, from_email, subject, received_at, summary")
        .eq("organization_id", organizationId)
        .eq("suggested_client_id", clientId)
        .order("received_at", { ascending: false })
        .limit(15),
    ]);

    const displayName = brokerClientDisplayName(c);
    const names = [displayName];
    if (c.company_name?.trim() && c.company_name.trim() !== displayName) {
      names.push(c.company_name.trim());
    }
    const references = [
      ...((contractsRes.data ?? []) as { policy_number: string | null }[]).map(
        (r) => r.policy_number,
      ),
      ...((claimsRes.data ?? []) as { reference: string | null }[]).map(
        (r) => r.reference,
      ),
    ].filter((r): r is string => Boolean(r && r.trim()));
    const criteria: ClientSearchCriteria = {
      emails: c.email ? [c.email.trim().toLowerCase()] : [],
      names,
      references,
      domain: companyEmailDomain(c.email, c.client_type === "company"),
    };

    const live = await searchMessagesForClient(
      access.accessToken,
      criteria,
      str(input, "query"),
      20,
    );
    // The briefing is per-broker, so colleagues who received the same email each
    // hold their own row for it — collapse them or the model sees duplicates.
    type LinkedRow = NonNullable<typeof linkedRes.data>[number];
    const linkedByMessage = new Map<string, LinkedRow>();
    for (const r of linkedRes.data ?? []) {
      const existing = linkedByMessage.get(r.graph_message_id);
      if (existing && (existing.summary || !r.summary)) continue;
      linkedByMessage.set(r.graph_message_id, r);
    }
    const linked = [...linkedByMessage.values()];
    const linkedIds = new Set(linked.map((r) => r.graph_message_id));
    return {
      client: displayName,
      // Emails the briefing already tied to this dossier (definitive links).
      linked_emails: linked.map((r) => ({
        message_id: r.graph_message_id,
        from: r.from_name || r.from_email,
        subject: r.subject,
        received_at: r.received_at,
        summary: r.summary,
      })),
      // Live mailbox matches (participant, name or reference cited).
      mailbox_matches: live
        .filter((m) => !linkedIds.has(m.id))
        .map((m) => ({
          message_id: m.id,
          from: m.fromName || m.fromEmail,
          from_email: m.fromEmail,
          subject: m.subject,
          received_at: m.receivedDateTime,
          preview: m.bodyPreview,
          has_attachments: m.hasAttachments,
        })),
      note: "Utilise read_email avec un message_id pour lire un email en entier.",
    };
  }

  if (name === "list_email_attachments") {
    const messageId = str(input, "message_id");
    if (!messageId) return { error: "message_id requis." };
    const access = await getOutlookAccessForUser(organizationId, ctx.userId);
    if (!access) return { error: "Boîte Outlook non connectée." };
    const attachments = await getMessageAttachmentsMeta(
      access.accessToken,
      messageId,
    );
    return {
      count: attachments.length,
      attachments: attachments.map((a) => ({
        attachment_id: a.id,
        name: a.name,
        content_type: a.contentType,
        size: formatBytes(a.size),
      })),
    };
  }

  if (name === "inspect_email_attachment") {
    const messageId = str(input, "message_id");
    const attachmentId = str(input, "attachment_id");
    if (!messageId || !attachmentId) {
      return { error: "message_id et attachment_id requis." };
    }
    const access = await getOutlookAccessForUser(organizationId, ctx.userId);
    if (!access) return { error: "Boîte Outlook non connectée." };
    const file = await getFileAttachmentBytes(
      access.accessToken,
      messageId,
      attachmentId,
    );
    if (!file) return { error: "Pièce jointe introuvable ou illisible." };
    if (!isReadableDocument(file.contentType, file.name)) {
      return {
        file_name: file.name,
        readable: false,
        note: "Ce type de fichier ne peut pas être lu automatiquement (ni PDF ni image).",
      };
    }
    const buffer = Buffer.from(file.contentBase64, "base64");
    const understood = await understandDocument({
      buffer,
      mimeType: file.contentType,
      fileName: file.name,
      organizationId,
    });
    if (!understood.ok) {
      return { file_name: file.name, readable: true, error: understood.message };
    }
    return {
      file_name: file.name,
      readable: true,
      detected_type: understood.data.category,
      detected_type_label: documentCategoryLabel(understood.data.category),
      label: understood.data.label,
      summary: understood.data.summary,
      concerns: understood.data.subject_name,
      hint: "Pour la ranger, utilise attach_email_attachment_to_client avec category = detected_type.",
    };
  }

  if (name === "inspect_uploaded_file") {
    const uploadId = str(input, "upload_id");
    if (!uploadId) return { error: "upload_id requis." };
    const upload = ctx.pendingUploads?.get(uploadId);
    if (!upload) {
      return {
        error:
          "Fichier introuvable. Demandez à l'utilisateur de joindre à nouveau le document.",
      };
    }
    if (!upload.storagePath.startsWith(`${organizationId}/_agent/`)) {
      return { error: "Référence de fichier invalide." };
    }
    if (!isReadableDocument(upload.mimeType, upload.fileName)) {
      return {
        file_name: upload.fileName,
        readable: false,
        note: "Ce type de fichier ne peut pas être lu automatiquement (ni PDF ni image).",
      };
    }
    const { data: blob, error: dlError } = await adminSupabase.storage
      .from(BROKER_FILES_BUCKET)
      .download(upload.storagePath);
    if (dlError || !blob) return { error: "Lecture du fichier impossible." };
    const buffer = Buffer.from(await blob.arrayBuffer());
    const understood = await understandDocument({
      buffer,
      mimeType: upload.mimeType,
      fileName: upload.fileName,
      organizationId,
    });
    if (!understood.ok) {
      return { file_name: upload.fileName, readable: true, error: understood.message };
    }
    return {
      file_name: upload.fileName,
      readable: true,
      detected_type: understood.data.category,
      detected_type_label: documentCategoryLabel(understood.data.category),
      label: understood.data.label,
      summary: understood.data.summary,
      concerns: understood.data.subject_name,
      hint: "Pour le ranger, utilise attach_uploaded_file_to_client avec category = detected_type.",
    };
  }

  if (name === "get_upcoming_renewals") {
    const withinDays = Math.min(
      Math.max(num(input, "within_days") ?? RENEWAL_HORIZON_DAYS, 1),
      365,
    );
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + withinDays);
    const horizonIso = horizon.toISOString().slice(0, 10);

    const { data } = await adminSupabase
      .from("broker_contracts")
      .select("*")
      .eq("organization_id", organizationId)
      .in("status", ["active", "pending"])
      .not("renewal_date", "is", null)
      .lte("renewal_date", horizonIso)
      .order("renewal_date", { ascending: true })
      .limit(50);

    const contracts = (data ?? []) as BrokerContractRow[];
    const clientIds = [...new Set(contracts.map((c) => c.client_id))];
    const namesById = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clientRows } = await adminSupabase
        .from("broker_clients")
        .select("*")
        .eq("organization_id", organizationId)
        .in("id", clientIds);
      for (const row of (clientRows ?? []) as BrokerClientRow[]) {
        namesById.set(row.id, brokerClientDisplayName(row));
      }
    }

    return {
      count: contracts.length,
      renewals: contracts.map((c) => {
        const days = daysUntil(c.renewal_date);
        return {
          client: namesById.get(c.client_id) ?? "Client",
          contract: contractDisplayLabel(c),
          premium: formatContractPremium(c),
          renewal_date: c.renewal_date,
          days_until: days,
          overdue: days !== null && days < 0,
          status: brokerContractStatusLabels[
            isBrokerContractStatus(c.status) ? c.status : "active"
          ],
          link: `/courtier/clients/${c.client_id}/contracts/${c.id}`,
        };
      }),
    };
  }

  if (name === "get_commission_summary") {
    const [commissionsRes, statementsRes] = await Promise.all([
      adminSupabase
        .from("broker_commissions")
        .select("commission_amount, retrocession_amount")
        .eq("organization_id", organizationId)
        .limit(5000),
      adminSupabase
        .from("broker_commission_statements")
        .select("status")
        .eq("organization_id", organizationId)
        .limit(2000),
    ]);
    const totals = sumCommissions(
      (commissionsRes.data ?? []) as {
        commission_amount: number | null;
        retrocession_amount: number | null;
      }[],
    );
    const statements = (statementsRes.data ?? []) as { status: string }[];
    const toReconcile = statements.filter(
      (s) => s.status === "received",
    ).length;
    return {
      commissions_gross: formatEuro(totals.gross),
      retrocessions: formatEuro(totals.retrocession),
      net_kept: formatEuro(totals.net),
      lines_count: totals.count,
      statements_total: statements.length,
      statements_to_reconcile: toReconcile,
    };
  }

  if (name === "get_open_claims") {
    const { data } = await adminSupabase
      .from("broker_claims")
      .select("*")
      .eq("organization_id", organizationId)
      .in("status", ["declared", "in_progress", "awaiting_docs"])
      .order("created_at", { ascending: false })
      .limit(Math.min(num(input, "limit") ?? 25, 100));

    const claims = (data ?? []) as BrokerClaimRow[];
    const clientIds = [...new Set(claims.map((c) => c.client_id))];
    const namesById = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clientRows } = await adminSupabase
        .from("broker_clients")
        .select("*")
        .eq("organization_id", organizationId)
        .in("id", clientIds);
      for (const row of (clientRows ?? []) as BrokerClientRow[]) {
        namesById.set(row.id, brokerClientDisplayName(row));
      }
    }

    return {
      count: claims.length,
      claims: claims.map((c) => ({
        client: namesById.get(c.client_id) ?? "Client",
        type: claimDisplayLabel(c),
        insurer: c.insurer_name,
        status:
          brokerClaimStatusLabels[
            isBrokerClaimStatus(c.status) ? c.status : "declared"
          ],
        occurrence_date: c.occurrence_date,
        estimate: c.amount_estimate
          ? formatEuro(c.amount_estimate, c.currency)
          : null,
        link: `/courtier/clients/${c.client_id}/claims/${c.id}`,
      })),
    };
  }

  // ---- EMAIL TOOLS (the user's own connected Outlook mailbox) ----
  if (name === "list_recent_emails") {
    const access = await getOutlookAccessForUser(organizationId, ctx.userId);
    if (!access) {
      return {
        error:
          "Boîte Outlook non connectée. Connectez-la dans Réglages → Intégrations.",
      };
    }
    const within = Math.min(Math.max(num(input, "within_days") ?? 3, 1), 30);
    const sinceIso = new Date(Date.now() - within * 86400_000).toISOString();
    // "The 25 latest" — a one-shot answer for the copilot, nothing resumes
    // from it, so newest-first is the right order here.
    const { messages } = await listRecentInboxMessages(
      access.accessToken,
      sinceIso,
      25,
      { order: "desc" },
    );
    return {
      mailbox: access.email,
      count: messages.length,
      emails: messages.map((m) => ({
        message_id: m.id,
        from: m.fromName || m.fromEmail,
        from_email: m.fromEmail,
        subject: m.subject,
        received_at: m.receivedDateTime,
        preview: m.bodyPreview,
        has_attachments: m.hasAttachments,
      })),
    };
  }

  if (name === "read_email") {
    const messageId = str(input, "message_id");
    if (!messageId) return { error: "message_id requis." };
    const access = await getOutlookAccessForUser(organizationId, ctx.userId);
    if (!access) return { error: "Boîte Outlook non connectée." };
    const message = await getOutlookMessageBody(access.accessToken, messageId);
    if (!message) return { error: "Email introuvable ou illisible." };
    return {
      from: message.fromName || message.fromEmail,
      from_email: message.fromEmail,
      subject: message.subject,
      received_at: message.receivedDateTime,
      body: message.body,
    };
  }

  if (name === "draft_email") {
    const to = str(input, "to");
    const subject = str(input, "subject");
    const body = str(input, "body");
    if (!to || !subject || !body) {
      return { error: "to, subject et body sont requis." };
    }
    try {
      const result = await createOutlookDraft({
        organizationId,
        userId: ctx.userId,
        to,
        subject,
        body,
      });
      return {
        drafted: true,
        mailbox: result.email,
        note: "Brouillon créé dans Outlook, à relire et envoyer. Aucun envoi automatique.",
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Création du brouillon impossible.",
      };
    }
  }

  // ---- ACTION TOOLS (require write permission) ----
  if (!ctx.canWrite) {
    return { error: "Votre rôle ne permet pas de modifier les données." };
  }

  if (name === "create_client") {
    const clientType = str(input, "client_type") === "company" ? "company" : "individual";
    const companyName = str(input, "company_name");
    const lastName = str(input, "last_name");
    const firstName = str(input, "first_name");
    if (clientType === "company" && !companyName) {
      return { error: "company_name requis pour une entreprise." };
    }
    if (clientType === "individual" && !lastName && !firstName) {
      return { error: "last_name (ou first_name) requis pour un particulier." };
    }
    const { data, error } = await adminSupabase
      .from("broker_clients")
      .insert({
        organization_id: organizationId,
        created_by: ctx.userId,
        client_type: clientType,
        first_name: firstName ?? null,
        last_name: lastName ?? null,
        company_name: companyName ?? null,
        email: str(input, "email") ?? null,
        phone: str(input, "phone") ?? null,
        insurance_type: insuranceTypeOf(input) ?? null,
        notes: str(input, "notes") ?? null,
        status: "new",
      })
      .select("*")
      .single();
    if (error || !data) {
      console.error("[agent] create_client failed:", error?.message);
      return { error: "Création impossible." };
    }
    await logBrokerActivity(adminSupabase, {
      organizationId,
      clientId: data.id,
      userId: ctx.userId,
      type: "client_created",
      description: `Dossier créé pour ${brokerClientDisplayName(data as BrokerClientRow)} (via assistant).`,
    });
    return {
      created: true,
      client_id: data.id,
      name: brokerClientDisplayName(data as BrokerClientRow),
      link: `/courtier/clients/${data.id}`,
    };
  }

  if (name === "update_client_status") {
    const clientId = str(input, "client_id");
    const status = str(input, "status");
    if (!clientId || !status || !isBrokerClientStatus(status)) {
      return { error: "client_id et status valide requis." };
    }
    const { data: existing } = await adminSupabase
      .from("broker_clients")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", clientId)
      .maybeSingle();
    if (!existing) return { error: "Dossier introuvable." };
    const { error } = await adminSupabase
      .from("broker_clients")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", clientId);
    if (error) return { error: "Mise à jour impossible." };
    await logBrokerActivity(adminSupabase, {
      organizationId,
      clientId,
      userId: ctx.userId,
      type: "status_changed",
      description: `Statut mis à jour : ${brokerClientStatusLabels[status]} (via assistant).`,
      metadata: { to: status },
    });
    return { updated: true, status: brokerClientStatusLabels[status] };
  }

  if (name === "update_client") {
    const clientId = str(input, "client_id");
    if (!clientId) return { error: "client_id requis." };
    const { data: existing } = await adminSupabase
      .from("broker_clients")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", clientId)
      .maybeSingle();
    if (!existing) return { error: "Dossier introuvable." };

    const update: Database["public"]["Tables"]["broker_clients"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    const firstName = str(input, "first_name");
    if (firstName !== undefined) update.first_name = firstName;
    const lastName = str(input, "last_name");
    if (lastName !== undefined) update.last_name = lastName;
    const companyName = str(input, "company_name");
    if (companyName !== undefined) update.company_name = companyName;
    const email = str(input, "email");
    if (email !== undefined) update.email = email;
    const phone = str(input, "phone");
    if (phone !== undefined) update.phone = phone;
    const address = str(input, "address");
    if (address !== undefined) update.address = address;
    const postalCode = str(input, "postal_code");
    if (postalCode !== undefined) update.postal_code = postalCode;
    const city = str(input, "city");
    if (city !== undefined) update.city = city;
    const insuranceType = insuranceTypeOf(input);
    if (insuranceType !== undefined) update.insurance_type = insuranceType;
    const notes = str(input, "notes");
    if (notes !== undefined) update.notes = notes;
    if (Object.keys(update).length === 1) {
      return { error: "Aucun champ à mettre à jour." };
    }

    const { data: updated, error } = await adminSupabase
      .from("broker_clients")
      .update(update)
      .eq("organization_id", organizationId)
      .eq("id", clientId)
      .select("*")
      .single();
    if (error || !updated) return { error: "Mise à jour impossible." };
    await logBrokerActivity(adminSupabase, {
      organizationId,
      clientId,
      userId: ctx.userId,
      type: "client_updated",
      description: "Informations du dossier mises à jour (via assistant).",
    });
    return {
      updated: true,
      client_id: clientId,
      name: brokerClientDisplayName(updated as BrokerClientRow),
      link: `/courtier/clients/${clientId}`,
    };
  }

  if (name === "attach_email_attachment_to_client") {
    const clientId = str(input, "client_id");
    const messageId = str(input, "message_id");
    const attachmentId = str(input, "attachment_id");
    if (!clientId || !messageId || !attachmentId) {
      return { error: "client_id, message_id et attachment_id requis." };
    }
    const { data: existing } = await adminSupabase
      .from("broker_clients")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", clientId)
      .maybeSingle();
    if (!existing) return { error: "Dossier introuvable." };

    const access = await getOutlookAccessForUser(organizationId, ctx.userId);
    if (!access) return { error: "Boîte Outlook non connectée." };

    const file = await getFileAttachmentBytes(
      access.accessToken,
      messageId,
      attachmentId,
    );
    if (!file) return { error: "Pièce jointe introuvable ou illisible." };

    const buffer = Buffer.from(file.contentBase64, "base64");
    const usage = computeStorageUsage(organization);
    if (usage.usedBytes + buffer.byteLength > usage.limitBytes) {
      return { error: "Quota de stockage atteint." };
    }

    const path = `${organizationId}/${clientId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await adminSupabase.storage
      .from(BROKER_FILES_BUCKET)
      .upload(path, buffer, { contentType: file.contentType, upsert: false });
    if (uploadError) return { error: "Enregistrement du fichier impossible." };

    const category = str(input, "category") ?? "other";
    const { data: document, error: docError } = await adminSupabase
      .from("broker_documents")
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        uploaded_by: ctx.userId,
        category,
        title: file.name,
        file_name: file.name,
        storage_path: path,
        mime_type: file.contentType,
        size_bytes: buffer.byteLength,
        status: "stored",
      })
      .select("id")
      .single();
    if (docError || !document) {
      await adminSupabase.storage.from(BROKER_FILES_BUCKET).remove([path]);
      return { error: "Rangement du document impossible." };
    }

    await adjustOrganizationStorage(adminSupabase, organizationId, buffer.byteLength);
    await logBrokerActivity(adminSupabase, {
      organizationId,
      clientId,
      userId: ctx.userId,
      type: "document_added",
      description: `Pièce jointe rangée depuis un email : ${file.name} (via assistant).`,
      metadata: { category, size_bytes: buffer.byteLength },
    });
    return {
      attached: true,
      document_id: document.id,
      file_name: file.name,
      link: `/courtier/clients/${clientId}`,
    };
  }

  if (name === "attach_uploaded_file_to_client") {
    const clientId = str(input, "client_id");
    const uploadId = str(input, "upload_id");
    if (!clientId || !uploadId) {
      return { error: "client_id et upload_id requis." };
    }
    const upload = ctx.pendingUploads?.get(uploadId);
    if (!upload) {
      return {
        error:
          "Fichier introuvable. Demandez à l'utilisateur de joindre à nouveau le document.",
      };
    }
    // Safety: only files staged by this workspace's chat can be filed.
    if (!upload.storagePath.startsWith(`${organizationId}/_agent/`)) {
      return { error: "Référence de fichier invalide." };
    }
    const { data: existing } = await adminSupabase
      .from("broker_clients")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", clientId)
      .maybeSingle();
    if (!existing) return { error: "Dossier introuvable." };

    const { data: blob, error: dlError } = await adminSupabase.storage
      .from(BROKER_FILES_BUCKET)
      .download(upload.storagePath);
    if (dlError || !blob) return { error: "Lecture du fichier impossible." };

    const buffer = Buffer.from(await blob.arrayBuffer());
    const usage = computeStorageUsage(organization);
    if (usage.usedBytes + buffer.byteLength > usage.limitBytes) {
      return { error: "Quota de stockage atteint." };
    }

    const path = `${organizationId}/${clientId}/${crypto.randomUUID()}-${sanitizeFileName(upload.fileName)}`;
    const { error: uploadError } = await adminSupabase.storage
      .from(BROKER_FILES_BUCKET)
      .upload(path, buffer, { contentType: upload.mimeType, upsert: false });
    if (uploadError) return { error: "Enregistrement du fichier impossible." };

    const category = str(input, "category") ?? "other";
    const { data: document, error: docError } = await adminSupabase
      .from("broker_documents")
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        uploaded_by: ctx.userId,
        category,
        title: upload.fileName,
        file_name: upload.fileName,
        storage_path: path,
        mime_type: upload.mimeType,
        size_bytes: buffer.byteLength,
        status: "stored",
      })
      .select("id")
      .single();
    if (docError || !document) {
      await adminSupabase.storage.from(BROKER_FILES_BUCKET).remove([path]);
      return { error: "Rangement du document impossible." };
    }

    await adjustOrganizationStorage(adminSupabase, organizationId, buffer.byteLength);
    // Staged copy is no longer needed once filed in the dossier.
    await adminSupabase.storage
      .from(BROKER_FILES_BUCKET)
      .remove([upload.storagePath]);
    await logBrokerActivity(adminSupabase, {
      organizationId,
      clientId,
      userId: ctx.userId,
      type: "document_added",
      description: `Document ajouté via l'assistant : ${upload.fileName}.`,
      metadata: { category, size_bytes: buffer.byteLength },
    });
    return {
      attached: true,
      document_id: document.id,
      file_name: upload.fileName,
      link: `/courtier/clients/${clientId}`,
    };
  }

  if (name === "generate_advice") {
    const clientId = str(input, "client_id");
    if (!clientId) return { error: "client_id requis." };
    const { data: client } = await adminSupabase
      .from("broker_clients")
      .select(clientSelect)
      .eq("organization_id", organizationId)
      .eq("id", clientId)
      .maybeSingle();
    if (!client) return { error: "Dossier introuvable." };

    // A dossier holds a single devoir de conseil — refuse a duplicate.
    const { data: existingAdvice } = await adminSupabase
      .from("broker_advice")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .limit(1)
      .maybeSingle();
    if (existingAdvice) {
      return {
        error:
          "Un devoir de conseil existe déjà pour ce dossier. Supprimez l'ancien avant d'en générer un nouveau.",
        existing_advice_id: existingAdvice.id,
        link: `/courtier/clients/${clientId}/advice/${existingAdvice.id}`,
      };
    }

    const { data: quote } = await adminSupabase
      .from("broker_quotes")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .eq("extraction_status", "validated")
      .order("validated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Same generation as the dossier's own flow: AI-written motifs (content)
    // + exigences (requirements) from the validated quote, with the editable
    // scaffold as fallback. Keeping both paths identical means an advice
    // created via the assistant renders exactly like one created in the UI.
    let content = buildAdviceJustificationDraft();
    let requirements: string | null = null;
    if (quote) {
      const ai = await generateAdviceContent(
        client as BrokerClientRow,
        quote as BrokerQuoteRow,
      );
      if (ai.success) {
        if (ai.motifs.trim()) content = ai.motifs;
        if (ai.requirements.trim()) requirements = ai.requirements;
      }
    }

    const now = new Date().toISOString();
    const { data: advice, error } = await adminSupabase
      .from("broker_advice")
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        quote_id: quote?.id ?? null,
        created_by: ctx.userId,
        title: "Devoir de conseil",
        content,
        requirements,
        status: "draft",
        generated_at: now,
      })
      .select("id")
      .single();
    if (error || !advice) {
      console.error("[agent] generate_advice failed:", error?.message);
      return { error: "Génération impossible." };
    }
    await logBrokerActivity(adminSupabase, {
      organizationId,
      clientId,
      userId: ctx.userId,
      type: "advice_created",
      description: "Devoir de conseil généré (via assistant) — à relire et valider.",
      metadata: { advice_id: advice.id },
    });
    return {
      generated: true,
      advice_id: advice.id,
      with_quote: Boolean(quote),
      link: `/courtier/clients/${clientId}/advice/${advice.id}`,
      note: quote
        ? "Brouillon rédigé à partir du devis validé — à relire, compléter et valider."
        : "Aucun devis validé sur ce dossier : brouillon à compléter manuellement.",
    };
  }

  return { error: `Outil inconnu : ${name}` };
}
