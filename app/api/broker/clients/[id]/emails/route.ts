import { NextResponse, type NextRequest } from "next/server";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import { requireBrokerApiContext } from "@/lib/broker/server";
import {
  companyEmailDomain,
  type ClientSearchCriteria,
  type OutlookMessage,
} from "@/lib/email/outlook-read";
import { getBrokerProfiles } from "@/lib/broker/profiles";
import { getMailboxClient } from "@/lib/email/mailbox-resolver";
import type { MailboxClient } from "@/lib/email/mailbox";
import type { BrokerClientRow } from "@/types/database";

export type ClientEmail = {
  id: string;
  subject: string;
  from: string;
  fromEmail: string;
  receivedAt: string;
  preview: string;
  hasAttachments: boolean;
  webLink: string;
  /**
   * "linked" = the briefing tied this email to the dossier (creation, update,
   * attachment, note) — definitive; "direct" = client is a participant;
   * "mention" = the live search found the client cited (name/ref).
   */
  matchType: "linked" | "direct" | "mention";
  /**
   * Sens de l'échange, du point de vue du cabinet. Un dossier doit montrer la
   * conversation complète : ce que le client a écrit ET ce qu'on lui a répondu.
   * "sent" = expédié depuis une des adresses du cabinet.
   */
  direction: "received" | "sent";
  /** Destinataires, affichés à la place de l'expéditeur sur un email envoyé. */
  to: string[];
};

type RouteContext = { params: Promise<{ id: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ message, reason, emails: [] }, { status });
}

/**
 * Emails concerning a client dossier — not only mail exchanged with the client's
 * address, but everything that mentions them: their name / company, their company
 * email domain, and their contract & claim references (e.g. an insurer's quote
 * that cites the policy number but not the client's email). Fetched live from the
 * connected Outlook mailbox. Optional `?q=` narrows with free text. Each result is
 * tagged "direct" (client is a participant) or "mention" (concerns them).
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const { id } = await ctx.params;
  const q = request.nextUrl.searchParams.get("q")?.trim() || undefined;
  const admin = auth.adminSupabase;
  const orgId = auth.organizationId;

  const { data: clientRow } = await admin
    .from("broker_clients")
    .select("id, client_type, first_name, last_name, company_name, email")
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  const client = clientRow as Pick<
    BrokerClientRow,
    "id" | "client_type" | "first_name" | "last_name" | "company_name" | "email"
  > | null;
  if (!client) return jsonError("Dossier introuvable.", 404, "not_found");

  // 1) Persisted links — emails the briefing tied to THIS dossier (creation,
  //    update, attachment, note). Definitive, independent of the live search and
  //    of whether the client even has an email address: this is what guarantees
  //    a dossier created from a third-party email still shows that email.
  const { data: linkedItems } = await admin
    .from("broker_email_items")
    .select(
      "graph_message_id, from_name, from_email, subject, received_at, web_link, has_attachments, summary",
    )
    .eq("organization_id", orgId)
    .eq("suggested_client_id", id)
    .order("received_at", { ascending: false })
    .limit(100);

  const needle = q?.toLowerCase();

  // One row per (user, message): the briefing is per-broker, so two colleagues
  // who both received the same email each hold their own row for it. We read
  // across the whole organization here, so the same message can come back
  // several times — collapse it, keeping whichever row carries a summary.
  const linkedById = new Map<string, ClientEmail>();
  for (const it of linkedItems ?? []) {
    const existing = linkedById.get(it.graph_message_id);
    if (existing && (existing.preview || !it.summary)) continue;
    linkedById.set(it.graph_message_id, {
      id: it.graph_message_id,
      subject: it.subject || "(sans objet)",
      from: it.from_name || it.from_email || "Expéditeur",
      fromEmail: it.from_email || "",
      receivedAt: it.received_at || "",
      preview: it.summary || "",
      hasAttachments: it.has_attachments ?? false,
      webLink: it.web_link || "",
      matchType: "linked",
      // Le briefing ne lit que la boîte de réception : un item rattaché est
      // toujours un email entrant.
      direction: "received",
      to: [],
    });
  }
  let linkedEmails: ClientEmail[] = [...linkedById.values()];
  if (needle) {
    linkedEmails = linkedEmails.filter((e) =>
      [e.subject, e.from, e.fromEmail, e.preview].some((f) =>
        f.toLowerCase().includes(needle),
      ),
    );
  }
  const linkedIds = new Set(linkedEmails.map((e) => e.id));

  // TOUTES les boîtes du cabinet, pas seulement celle de la personne connectée :
  // un dossier doit montrer la conversation complète, même si c'est un collègue
  // qui a échangé avec l'assuré. Chaque profil a la sienne.
  const profiles = await getBrokerProfiles(orgId);
  const resolved = await Promise.all([
    getMailboxClient({
      organizationId: orgId,
      userId: auth.user.id,
      profileId: null,
      adminSupabase: admin,
    }),
    ...profiles.map((p) =>
      getMailboxClient({
        organizationId: orgId,
        userId: auth.user.id,
        profileId: p.id,
        adminSupabase: admin,
      }),
    ),
  ]);

  // Deux profils peuvent retomber sur la même boîte de repli (Microsoft) : on
  // dédoublonne par adresse pour ne pas chercher trois fois la même chose.
  const seenAddresses = new Set<string>();
  const mailboxes: MailboxClient[] = [];
  for (const mb of resolved) {
    if (!mb) continue;
    if (seenAddresses.has(mb.address)) {
      await mb.close();
      continue;
    }
    seenAddresses.add(mb.address);
    mailboxes.push(mb);
  }

  // Adresses du cabinet, tous profils confondus : c'est ce qui permet de
  // reconnaître un email SORTANT, y compris envoyé depuis un alias.
  const mailboxAddresses = new Set<string>();
  for (const mb of mailboxes) {
    for (const addr of mb.addresses) mailboxAddresses.add(addr);
  }
  for (const p of profiles) {
    if (p.email) mailboxAddresses.add(p.email.trim().toLowerCase());
  }
  const access = mailboxes[0] ?? null;

  // 2) Live mailbox search (direct exchanges + mentions), merged with the
  //    persisted links which always take precedence.
  let liveEmails: ClientEmail[] = [];
  let criteriaEmpty = true;
  try {
    if (access) {
      // Gather every signal that identifies this client.
      const [{ data: contracts }, { data: claims }] = await Promise.all([
        admin
          .from("broker_contracts")
          .select("policy_number")
          .eq("organization_id", orgId)
          .eq("client_id", id)
          .not("policy_number", "is", null)
          .limit(50),
        admin
          .from("broker_claims")
          .select("reference")
          .eq("organization_id", orgId)
          .eq("client_id", id)
          .not("reference", "is", null)
          .limit(50),
      ]);

      const displayName = brokerClientDisplayName(client);
      const names = [displayName];
      if (
        client.company_name?.trim() &&
        client.company_name.trim() !== displayName
      ) {
        names.push(client.company_name.trim());
      }

      const references = [
        ...(contracts ?? []).map(
          (c) => (c as { policy_number: string | null }).policy_number,
        ),
        ...(claims ?? []).map((c) => (c as { reference: string | null }).reference),
      ].filter((r): r is string => Boolean(r && r.trim()));

      const domain = companyEmailDomain(
        client.email,
        client.client_type === "company",
      );

      const criteria: ClientSearchCriteria = {
        emails: client.email ? [client.email.trim().toLowerCase()] : [],
        names,
        references,
        domain,
      };
      criteriaEmpty =
        criteria.emails.length === 0 &&
        criteria.names.length === 0 &&
        criteria.references.length === 0 &&
        !criteria.domain;

      if (!criteriaEmpty) {
        // Une recherche par boîte, fusionnée par identifiant : un même email
        // adressé à deux personnes du cabinet ne doit apparaître qu'une fois.
        const perMailbox = await Promise.all(
          mailboxes.map((mb) =>
            mb.searchForClient(criteria, q).catch(() => [] as OutlookMessage[]),
          ),
        );
        const byId = new Map<string, OutlookMessage>();
        for (const list of perMailbox) {
          for (const m of list) if (!byId.has(m.id)) byId.set(m.id, m);
        }
        const messages = [...byId.values()].sort((a, b) =>
          (b.receivedDateTime ?? "").localeCompare(a.receivedDateTime ?? ""),
        );
        const emailSet = new Set(criteria.emails);
        const isDirect = (m: OutlookMessage): boolean => {
          if (m.fromEmail && emailSet.has(m.fromEmail)) return true;
          if (m.recipients.some((r) => emailSet.has(r))) return true;
          if (criteria.domain) {
            const at = `@${criteria.domain}`;
            if (m.fromEmail.endsWith(at)) return true;
            if (m.recipients.some((r) => r.endsWith(at))) return true;
          }
          return false;
        };
        liveEmails = messages
          .filter((m) => !linkedIds.has(m.id))
          .map((m) => {
            const sent = Boolean(m.fromEmail && mailboxAddresses.has(m.fromEmail));
            return {
              id: m.id,
              subject: m.subject,
              from: m.fromName || m.fromEmail,
              fromEmail: m.fromEmail,
              receivedAt: m.receivedDateTime,
              preview: m.bodyPreview,
              hasAttachments: m.hasAttachments,
              webLink: m.webLink,
              matchType: (isDirect(m) ? "direct" : "mention") as
                | "direct"
                | "mention",
              direction: (sent ? "sent" : "received") as "received" | "sent",
              // Sur un email envoyé, le destinataire est l'information utile.
              to: sent
                ? m.recipients.filter((r) => !mailboxAddresses.has(r))
                : [],
            };
          });
      }
    }
  } finally {
    // Sessions IMAP refermées quoi qu'il arrive : une connexion oubliée reste
    // ouverte côté serveur de messagerie et finit par saturer son quota.
    await Promise.all(mailboxes.map((mb) => mb.close()));
  }

  // Nothing persisted and no way to search live → keep the guiding empty states.
  if (linkedEmails.length === 0) {
    if (!access) return NextResponse.json({ emails: [], reason: "not_connected" });
    if (criteriaEmpty) return NextResponse.json({ emails: [], reason: "no_criteria" });
  }

  return NextResponse.json({
    emails: [...linkedEmails, ...liveEmails],
    mailbox: access?.address,
  });
}
