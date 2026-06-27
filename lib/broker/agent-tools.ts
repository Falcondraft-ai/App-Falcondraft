import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAdviceTemplate } from "@/lib/broker/advice";
import { brokerAdviceStatusLabels } from "@/lib/broker/advice";
import {
  brokerClientDisplayName,
  brokerClientStatusLabels,
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
} from "@/lib/broker/contracts";
import { documentCategoryLabel } from "@/lib/broker/documents";
import {
  brokerQuoteStatusLabels,
  formatPremium,
} from "@/lib/broker/quotes";
import { logBrokerActivity } from "@/lib/broker/server";
import { computeStorageUsage, formatBytes } from "@/lib/broker/storage";
import { createOutlookDraft } from "@/lib/email/outlook-drafts";
import {
  getOutlookAccessForUser,
  getOutlookMessageBody,
  listRecentInboxMessages,
} from "@/lib/email/outlook-read";
import type {
  BrokerClaimRow,
  BrokerClientRow,
  BrokerContractRow,
  BrokerQuoteRow,
  Database,
  OrganizationRow,
} from "@/types/database";

export type AgentToolContext = {
  adminSupabase: SupabaseClient<Database>;
  organization: OrganizationRow;
  userId: string;
  canWrite: boolean;
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
      "Vue complète d'un dossier : informations, besoins, documents, devis compagnies, devoirs de conseil, historique. Toujours utiliser avant de détailler un dossier.",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string" } },
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
    name: "get_upcoming_renewals",
    description:
      "Liste les contrats dont l'échéance arrive bientôt ou est dépassée (renouvellements à suivre), triés du plus urgent au moins urgent. Paramètre within_days (défaut 60).",
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
      "Crée un nouveau dossier client. À n'utiliser que si l'utilisateur le demande explicitement. Pour un particulier, fournir au moins last_name ; pour une entreprise, company_name.",
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
          description: "auto, habitation, sante, prevoyance, emprunteur, pro, epargne, autre",
        },
        needs: { type: "string", description: "Recueil de besoins." },
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
    name: "generate_advice",
    description:
      "Génère un brouillon de devoir de conseil pour un dossier, pré-rempli à partir des besoins et du dernier devis validé. Renvoie le lien à ouvrir pour le relire et le valider.",
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

    const [docs, quotes, advice, activity] = await Promise.all([
      adminSupabase.from("broker_documents").select("title, category, size_bytes").eq("organization_id", organizationId).eq("client_id", clientId),
      adminSupabase.from("broker_quotes").select("insurer_name, product_name, premium_monthly, currency, extraction_status").eq("organization_id", organizationId).eq("client_id", clientId),
      adminSupabase.from("broker_advice").select("title, status, updated_at").eq("organization_id", organizationId).eq("client_id", clientId),
      adminSupabase.from("broker_activity").select("type, description, created_at").eq("organization_id", organizationId).eq("client_id", clientId).order("created_at", { ascending: false }).limit(8),
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
      needs: c.needs,
      notes: c.notes,
      link: `/courtier/clients/${c.id}`,
      documents: (docs.data ?? []).map((d) => ({
        title: d.title,
        category: documentCategoryLabel(d.category),
        size: formatBytes(d.size_bytes ?? 0),
      })),
      quotes: (quotes.data ?? []).map((q) => ({
        insurer: q.insurer_name,
        product: q.product_name,
        premium_monthly: formatPremium(q.premium_monthly, q.currency),
        status: brokerQuoteStatusLabels[(q.extraction_status as keyof typeof brokerQuoteStatusLabels) ?? "pending"],
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

  if (name === "get_upcoming_renewals") {
    const withinDays = Math.min(
      Math.max(num(input, "within_days") ?? 60, 1),
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
    const messages = await listRecentInboxMessages(access.accessToken, sinceIso, 25);
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
        insurance_type: str(input, "insurance_type") ?? null,
        needs: str(input, "needs") ?? null,
        status: "new",
      })
      .select("*")
      .single();
    if (error || !data) return { error: "Création impossible." };
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

    const { data: quote } = await adminSupabase
      .from("broker_quotes")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .eq("extraction_status", "validated")
      .order("validated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const content = buildAdviceTemplate(
      client as BrokerClientRow,
      (quote as BrokerQuoteRow | null) ?? null,
    );
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
        status: "draft",
        generated_at: now,
      })
      .select("id")
      .single();
    if (error || !advice) return { error: "Génération impossible." };
    await logBrokerActivity(adminSupabase, {
      organizationId,
      clientId,
      userId: ctx.userId,
      type: "advice_created",
      description: "Devoir de conseil généré (via assistant).",
      metadata: { advice_id: advice.id },
    });
    return {
      generated: true,
      advice_id: advice.id,
      link: `/courtier/clients/${clientId}/advice/${advice.id}`,
      note: "Brouillon à relire, compléter et valider.",
    };
  }

  return { error: `Outil inconnu : ${name}` };
}
