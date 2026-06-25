import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  brokerClientDisplayName,
  brokerInsuranceTypes,
} from "@/lib/broker/clients";
import {
  getMessageAttachmentsMeta,
  getOutlookAccessForUser,
  listRecentInboxMessages,
  type OutlookMessage,
} from "@/lib/email/outlook-read";
import {
  isEmailCategory,
  normalizeAttachmentCategory,
} from "@/lib/broker/outlook";
import type { BrokerClientRow, Database } from "@/types/database";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DIGEST_MODEL = "gpt-5.5";
const MAX_EMAILS = 40;
const MAX_WINDOW_DAYS = 7;

export type DigestContext = {
  adminSupabase: SupabaseClient<Database>;
  organizationId: string;
  userId: string;
  userName: string;
};

export type GenerateDigestResult =
  | { success: true; digestId: string; relevant: number; excluded: number }
  | { success: false; reason: string; message: string };

type AttachmentRef = {
  ref: string;
  messageId: string;
  attachmentId: string;
  name: string;
  contentType: string;
  size: number;
};

type AiAction = {
  type?: string;
  attachment_ref?: string;
  document_category?: string;
  subject?: string;
  body?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  email?: string;
  insurance_type?: string;
  needs?: string;
  claim_type?: string;
  description?: string;
  note?: string;
};

type AiEmailResult = {
  ref?: string;
  relevant?: boolean;
  category?: string;
  summary?: string;
  urgency?: string;
  client_match_email?: string | null;
  actions?: AiAction[];
};

type AiResponse = {
  narrative?: string;
  emails?: AiEmailResult[];
};

function buildSystemPrompt(userName: string): string {
  return [
    `Tu es l'assistant de tri du courrier d'un cabinet de courtage en assurance. Tu travailles pour ${userName}.`,
    `On te donne les emails reçus récemment dans sa boîte Outlook, et la liste de ses clients existants.`,
    ``,
    `TON RÔLE : produire un briefing du jour utile et RÉELLEMENT trié.`,
    ``,
    `RÈGLE DE PERTINENCE (la plus importante) :`,
    `- Ne garde (relevant=true) QUE les emails en lien direct avec l'activité de courtage en assurance :`,
    `  demandes de clients/prospects, devis de compagnies, contrats/souscriptions, sinistres, échéances/renouvellements, factures liées à l'activité, échanges avec des assureurs.`,
    `- Mets relevant=false pour TOUT le reste : publicités, newsletters, notifications de plateformes, réseaux sociaux, démarchage, spam, emails personnels, relevés bancaires non liés, etc.`,
    `- Dans le doute qu'un email soit vraiment lié au courtage, mets relevant=false. Mieux vaut écarter que polluer.`,
    ``,
    `ACTIONS — ne propose une action QUE si elle a un sens évident après avoir lu le contenu :`,
    `- attach_document : seulement si une pièce jointe est un vrai document d'assurance (devis, contrat, RIB, pièce d'identité, justificatif). document_category ∈ company_quote|contract|rib|id_document|other.`,
    `- draft_reply : seulement si l'email appelle clairement une réponse. Rédige un brouillon court, professionnel, en français, prêt à relire (jamais de promesse ferme).`,
    `- create_client : UNIQUEMENT si l'expéditeur est un vrai prospect/particulier/entreprise qui sollicite le cabinet pour de l'assurance ET qu'il ne correspond à aucun client existant. JAMAIS pour un assureur, un fournisseur, une plateforme, une pub. Extrait nom/prénom (ou raison sociale), email, et la branche probable (${brokerInsuranceTypes.join(", ")}).`,
    `- declare_claim : seulement si l'email évoque un sinistre concret (dégât, accident, vol...). Donne claim_type et une courte description.`,
    `- flag_renewal : seulement si l'email mentionne une échéance/résiliation/renouvellement de contrat.`,
    ``,
    `RATTACHEMENT : si l'expéditeur correspond à un client existant (par email surtout), renseigne client_match_email avec son adresse exacte.`,
    ``,
    `NARRATIF : rédige "narrative" = 2 à 4 phrases, ton chaleureux et professionnel, qui raconte l'essentiel de la matinée ("Ce matin, ..."), met en avant l'urgent. Pas d'emojis, pas de jargon technique.`,
    ``,
    `Réponds STRICTEMENT en JSON valide correspondant au schéma demandé. N'invente pas de pièces jointes : n'utilise que les attachment_ref fournis.`,
  ].join("\n");
}

function buildUserPayload(
  messages: OutlookMessage[],
  attachmentsByMessage: Map<string, AttachmentRef[]>,
  clientRoster: { name: string; email: string }[],
): string {
  const emails = messages.map((m, i) => ({
    ref: `e${i}`,
    from_name: m.fromName,
    from_email: m.fromEmail,
    subject: m.subject,
    received_at: m.receivedDateTime,
    preview: m.bodyPreview,
    attachments: (attachmentsByMessage.get(m.id) ?? []).map((a) => ({
      ref: a.ref,
      name: a.name,
      content_type: a.contentType,
    })),
  }));

  return JSON.stringify({
    instructions: "Trie ces emails et propose les actions pertinentes.",
    known_clients: clientRoster,
    emails,
    expected_schema: {
      narrative: "string",
      emails: [
        {
          ref: "e0",
          relevant: true,
          category:
            "prospect|client_request|quote|contract|claim|renewal|invoice|other_broker",
          summary: "string",
          urgency: "normal|high",
          client_match_email: "string|null",
          actions: [
            {
              type: "attach_document",
              attachment_ref: "e0a0",
              document_category: "company_quote",
            },
            { type: "draft_reply", subject: "string", body: "string" },
            {
              type: "create_client",
              first_name: "string",
              last_name: "string",
              company_name: "string",
              email: "string",
              insurance_type: "auto",
              needs: "string",
            },
            { type: "declare_claim", claim_type: "string", description: "string" },
            { type: "flag_renewal", note: "string" },
          ],
        },
      ],
    },
  });
}

async function classifyEmails(
  apiKey: string,
  userName: string,
  messages: OutlookMessage[],
  attachmentsByMessage: Map<string, AttachmentRef[]>,
  clientRoster: { name: string; email: string }[],
): Promise<AiResponse | null> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: DIGEST_MODEL,
      response_format: { type: "json_object" },
      max_completion_tokens: 4000,
      messages: [
        { role: "system", content: buildSystemPrompt(userName) },
        {
          role: "user",
          content: buildUserPayload(
            messages,
            attachmentsByMessage,
            clientRoster,
          ),
        },
      ],
    }),
  }).catch(() => null);

  if (!res || !res.ok) {
    console.error("[digest] openai error", res?.status);
    return null;
  }

  const payload = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content) as AiResponse;
  } catch {
    console.error("[digest] failed to parse AI JSON");
    return null;
  }
}

/**
 * Generates a fresh email briefing for the user: reads new Outlook messages
 * since the last digest, classifies them (strict brokerage relevance), and
 * persists the digest + relevant items + proposed actions. Nothing is executed
 * — the broker validates each suggestion afterwards.
 */
export async function generateDigest(
  ctx: DigestContext,
): Promise<GenerateDigestResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      reason: "ai_unconfigured",
      message: "L’assistant n’est pas encore activé (OPENAI_API_KEY manquant).",
    };
  }

  const access = await getOutlookAccessForUser(ctx.organizationId, ctx.userId);
  if (!access) {
    return {
      success: false,
      reason: "not_connected",
      message: "Connectez votre boîte Outlook pour générer le briefing.",
    };
  }

  // Window: since the last digest, capped to MAX_WINDOW_DAYS.
  const { data: lastDigest } = await ctx.adminSupabase
    .from("broker_email_digests")
    .select("window_end")
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const floor = new Date(now.getTime() - MAX_WINDOW_DAYS * 86400_000);
  let since = new Date(now.getTime() - 86400_000);
  if (lastDigest?.window_end) {
    const prev = new Date(lastDigest.window_end);
    if (!Number.isNaN(prev.getTime())) since = prev;
  }
  if (since < floor) since = floor;
  const sinceIso = since.toISOString();

  const allMessages = await listRecentInboxMessages(
    access.accessToken,
    sinceIso,
    MAX_EMAILS,
  );

  // Skip messages already processed in an earlier digest (idempotency).
  let messages = allMessages;
  if (allMessages.length > 0) {
    const ids = allMessages.map((m) => m.id);
    const { data: seen } = await ctx.adminSupabase
      .from("broker_email_items")
      .select("graph_message_id")
      .eq("organization_id", ctx.organizationId)
      .eq("user_id", ctx.userId)
      .in("graph_message_id", ids);
    const seenSet = new Set((seen ?? []).map((r) => r.graph_message_id));
    messages = allMessages.filter((m) => !seenSet.has(m.id));
  }

  // Empty window → still record a digest so the UI shows "nothing new".
  if (messages.length === 0) {
    const { data: digest } = await ctx.adminSupabase
      .from("broker_email_digests")
      .insert({
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        status: "ready",
        narrative:
          "Rien de nouveau depuis votre dernier briefing. Boîte à jour côté courtage.",
        window_start: sinceIso,
        window_end: now.toISOString(),
        relevant_count: 0,
        excluded_count: 0,
        generated_at: now.toISOString(),
      })
      .select("id")
      .single();
    return {
      success: true,
      digestId: digest?.id ?? "",
      relevant: 0,
      excluded: 0,
    };
  }

  // Attachment metadata for messages that have attachments.
  const attachmentsByMessage = new Map<string, AttachmentRef[]>();
  const attachmentByRef = new Map<string, AttachmentRef>();
  await Promise.all(
    messages.map(async (m, i) => {
      if (!m.hasAttachments) return;
      const metas = await getMessageAttachmentsMeta(access.accessToken, m.id);
      const refs = metas.map((meta, j) => {
        const ref: AttachmentRef = {
          ref: `e${i}a${j}`,
          messageId: m.id,
          attachmentId: meta.id,
          name: meta.name,
          contentType: meta.contentType,
          size: meta.size,
        };
        attachmentByRef.set(ref.ref, ref);
        return ref;
      });
      if (refs.length > 0) attachmentsByMessage.set(m.id, refs);
    }),
  );

  // Client roster for matching (email + display name).
  const { data: clientRows } = await ctx.adminSupabase
    .from("broker_clients")
    .select("*")
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .limit(500);
  const clients = (clientRows ?? []) as BrokerClientRow[];
  const clientByEmail = new Map<string, BrokerClientRow>();
  for (const c of clients) {
    if (c.email) clientByEmail.set(c.email.trim().toLowerCase(), c);
  }
  const clientRoster = clients
    .filter((c) => c.email)
    .slice(0, 200)
    .map((c) => ({ name: brokerClientDisplayName(c), email: c.email! }));

  const ai = await classifyEmails(
    apiKey,
    ctx.userName,
    messages,
    attachmentsByMessage,
    clientRoster,
  );

  if (!ai) {
    return {
      success: false,
      reason: "ai_failed",
      message: "L’analyse de vos emails a échoué. Réessayez dans un instant.",
    };
  }

  const resultByRef = new Map<string, AiEmailResult>();
  for (const e of ai.emails ?? []) {
    if (e.ref) resultByRef.set(e.ref, e);
  }

  // Create the digest shell first so items can reference it.
  const { data: digest, error: digestError } = await ctx.adminSupabase
    .from("broker_email_digests")
    .insert({
      organization_id: ctx.organizationId,
      user_id: ctx.userId,
      status: "ready",
      narrative: ai.narrative?.trim() || null,
      window_start: sinceIso,
      window_end: now.toISOString(),
      generated_at: now.toISOString(),
    })
    .select("id")
    .single();

  if (digestError || !digest) {
    return {
      success: false,
      reason: "persist_failed",
      message:
        "Enregistrement du briefing impossible. Vérifiez que la migration 0044 est appliquée.",
    };
  }

  let relevant = 0;
  let excluded = 0;

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    const r = resultByRef.get(`e${i}`);
    if (!r || r.relevant === false) {
      excluded += 1;
      continue;
    }

    // Resolve the matched client: exact sender-email match wins, else AI hint.
    let clientId: string | null = null;
    const senderMatch = clientByEmail.get(message.fromEmail);
    if (senderMatch) clientId = senderMatch.id;
    else if (r.client_match_email) {
      const m = clientByEmail.get(r.client_match_email.trim().toLowerCase());
      if (m) clientId = m.id;
    }

    const category =
      r.category && isEmailCategory(r.category) ? r.category : "other_broker";

    const { data: item } = await ctx.adminSupabase
      .from("broker_email_items")
      .insert({
        organization_id: ctx.organizationId,
        digest_id: digest.id,
        user_id: ctx.userId,
        graph_message_id: message.id,
        from_name: message.fromName || null,
        from_email: message.fromEmail || null,
        subject: message.subject,
        received_at: message.receivedDateTime || null,
        web_link: message.webLink || null,
        category,
        summary: r.summary?.trim() || null,
        urgency: r.urgency === "high" ? "high" : "normal",
        suggested_client_id: clientId,
        has_attachments: message.hasAttachments,
      })
      .select("id")
      .single();

    if (!item) continue;
    relevant += 1;

    // Build the suggestion rows from the AI actions.
    const suggestionRows: Database["public"]["Tables"]["broker_email_suggestions"]["Insert"][] =
      [];
    for (const action of r.actions ?? []) {
      if (action.type === "attach_document") {
        const att = action.attachment_ref
          ? attachmentByRef.get(action.attachment_ref)
          : undefined;
        if (!att) continue;
        suggestionRows.push({
          organization_id: ctx.organizationId,
          item_id: item.id,
          user_id: ctx.userId,
          type: "attach_document",
          payload: {
            graph_message_id: att.messageId,
            graph_attachment_id: att.attachmentId,
            file_name: att.name,
            content_type: att.contentType,
            size: att.size,
            document_category: normalizeAttachmentCategory(
              action.document_category,
            ),
            client_id: clientId,
          },
        });
      } else if (action.type === "draft_reply") {
        if (!action.body?.trim()) continue;
        suggestionRows.push({
          organization_id: ctx.organizationId,
          item_id: item.id,
          user_id: ctx.userId,
          type: "draft_reply",
          payload: {
            to: message.fromEmail,
            subject:
              action.subject?.trim() || `RE: ${message.subject}`.slice(0, 240),
            body: action.body.trim(),
          },
        });
      } else if (action.type === "create_client") {
        // Only meaningful when no existing client matched.
        if (clientId) continue;
        const insuranceType =
          action.insurance_type &&
          (brokerInsuranceTypes as readonly string[]).includes(
            action.insurance_type,
          )
            ? action.insurance_type
            : null;
        suggestionRows.push({
          organization_id: ctx.organizationId,
          item_id: item.id,
          user_id: ctx.userId,
          type: "create_client",
          payload: {
            first_name: action.first_name?.trim() || null,
            last_name: action.last_name?.trim() || null,
            company_name: action.company_name?.trim() || null,
            email: action.email?.trim() || message.fromEmail || null,
            insurance_type: insuranceType,
            needs: action.needs?.trim() || null,
          },
        });
      } else if (action.type === "declare_claim") {
        suggestionRows.push({
          organization_id: ctx.organizationId,
          item_id: item.id,
          user_id: ctx.userId,
          type: "declare_claim",
          payload: {
            client_id: clientId,
            claim_type: action.claim_type?.trim() || null,
            description: action.description?.trim() || null,
          },
        });
      } else if (action.type === "flag_renewal") {
        suggestionRows.push({
          organization_id: ctx.organizationId,
          item_id: item.id,
          user_id: ctx.userId,
          type: "flag_renewal",
          payload: {
            client_id: clientId,
            note: action.note?.trim() || null,
          },
        });
      }
    }

    if (suggestionRows.length > 0) {
      await ctx.adminSupabase
        .from("broker_email_suggestions")
        .insert(suggestionRows);
    }
  }

  await ctx.adminSupabase
    .from("broker_email_digests")
    .update({
      relevant_count: relevant,
      excluded_count: excluded,
      updated_at: new Date().toISOString(),
    })
    .eq("id", digest.id);

  return { success: true, digestId: digest.id, relevant, excluded };
}
