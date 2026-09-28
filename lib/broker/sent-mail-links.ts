import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MailMessage } from "@/lib/email/mailbox";
import { outlookOAuthProvider } from "@/lib/email/microsoft-oauth";
import { getMailboxClient, IMAP_PROVIDER } from "@/lib/email/mailbox-resolver";
import type { Database } from "@/types/database";

/**
 * Files what the cabinet SENT into the dossiers it concerns.
 *
 * The briefing only reads the inbox, so a dossier used to show what the client
 * wrote but never what the broker answered. This walks each mailbox's sent
 * folder and links every email addressed to a dossier's email address — no AI,
 * no guess: an exact address match, and only when it points to ONE dossier.
 *
 * Each mailbox keeps a cursor (email_connections.sent_synced_at) that moves past
 * everything read, linked or not; the first run looks back FIRST_SYNC_DAYS so
 * the history is there from day one.
 */

const FIRST_SYNC_DAYS = 180;
/** Per mailbox and per run; a longer backlog resumes on the next run. */
const MAX_PER_RUN = 500;

export type SentMailTarget = {
  id: string;
  organization_id: string;
  user_id: string;
  profile_id: string | null;
  sent_synced_at: string | null;
};

type Admin = SupabaseClient<Database>;

/** Dossier email → dossier id, ambiguous addresses left out. */
async function dossierAddresses(
  admin: Admin,
  organizationId: string,
  cabinetAddresses: Set<string>,
): Promise<Map<string, string>> {
  // Raw read, all dossier types: this resolves addresses, it counts nothing (a
  // mail to an insurer's dossier belongs in that dossier too).
  const { data } = await admin
    .from("broker_clients")
    .select("id, email")
    .eq("organization_id", organizationId)
    .not("email", "is", null)
    .limit(5000);

  const byAddress = new Map<string, string | null>();
  for (const row of (data ?? []) as { id: string; email: string | null }[]) {
    const address = row.email?.trim().toLowerCase();
    if (!address || cabinetAddresses.has(address)) continue;
    // Two dossiers sharing one address: we can't tell which one → neither.
    byAddress.set(address, byAddress.has(address) ? null : row.id);
  }
  const resolved = new Map<string, string>();
  for (const [address, id] of byAddress) if (id) resolved.set(address, id);
  return resolved;
}

/** The dossier an email was sent to: its first recipient that is one. */
function dossierFor(message: MailMessage, addresses: Map<string, string>): string | null {
  for (const recipient of message.recipients) {
    const id = addresses.get(recipient);
    if (id) return id;
  }
  return null;
}

export async function linkSentMail(
  admin: Admin,
  target: SentMailTarget,
): Promise<{ scanned: number; linked: number }> {
  const mailbox = await getMailboxClient({
    organizationId: target.organization_id,
    userId: target.user_id,
    profileId: target.profile_id,
    adminSupabase: admin,
  });
  if (!mailbox) return { scanned: 0, linked: 0 };

  try {
    // Taken BEFORE reading: a mail sent while this run works is picked up next time.
    const startedAt = new Date().toISOString();
    const since =
      target.sent_synced_at ??
      new Date(Date.now() - FIRST_SYNC_DAYS * 86_400_000).toISOString();
    const page = await mailbox.listSent(since, MAX_PER_RUN);

    const { data: profiles } = await admin
      .from("broker_profiles")
      .select("email")
      .eq("organization_id", target.organization_id);
    const cabinetAddresses = new Set<string>(mailbox.addresses);
    for (const p of profiles ?? []) {
      const address = p.email?.trim().toLowerCase();
      if (address) cabinetAddresses.add(address);
    }

    const addresses = await dossierAddresses(admin, target.organization_id, cabinetAddresses);
    const candidates = page.messages
      .map((message) => ({ message, clientId: dossierFor(message, addresses) }))
      .filter((c): c is { message: MailMessage; clientId: string } => Boolean(c.clientId));

    let linked = 0;
    if (candidates.length > 0) {
      // Already filed (a previous run, a manual link, a re-scan of the cursor
      // boundary): left untouched — a broker’s manual choice wins.
      // By batches: hundreds of message ids in one filter would overflow the URL.
      const known = new Set<string>();
      const ids = candidates.map((c) => c.message.id);
      for (let i = 0; i < ids.length; i += 100) {
        let existingQuery = admin
          .from("broker_email_items")
          .select("graph_message_id")
          .eq("organization_id", target.organization_id)
          .in("graph_message_id", ids.slice(i, i + 100));
        existingQuery = target.profile_id
          ? existingQuery.eq("profile_id", target.profile_id)
          : existingQuery.is("profile_id", null);
        const { data: existing } = await existingQuery;
        for (const row of existing ?? []) known.add(row.graph_message_id);
      }

      const now = new Date().toISOString();
      const rows = candidates
        .filter((c) => !known.has(c.message.id))
        .map(({ message, clientId }) => ({
          organization_id: target.organization_id,
          digest_id: null,
          user_id: target.user_id,
          profile_id: target.profile_id,
          graph_message_id: message.id,
          from_name: message.fromName || null,
          from_email: message.fromEmail || mailbox.address,
          subject: message.subject || null,
          received_at: message.receivedDateTime || null,
          web_link: message.webLink || null,
          mailbox_address: mailbox.address,
          relevance: "relevant",
          suggested_client_id: clientId,
          has_attachments: message.hasAttachments,
          status: "reviewed",
          direction: "sent",
          to_emails: message.recipients,
          updated_at: now,
        }));

      if (rows.length > 0) {
        const { error } = await admin.from("broker_email_items").insert(rows);
        if (!error) {
          linked = rows.length;
        } else {
          // A concurrent run filed one of them first: fall back to one by one so
          // the rest still lands.
          for (const row of rows) {
            const { error: rowError } = await admin.from("broker_email_items").insert(row);
            if (!rowError) linked += 1;
          }
        }
      }
    }

    // Past everything read, dossier or not. A truncated page resumes from its
    // last message; a complete one from now.
    const newest = page.messages.reduce<string | null>(
      (max, m) => (m.receivedDateTime && (!max || m.receivedDateTime > max) ? m.receivedDateTime : max),
      null,
    );
    const cursor = page.truncated && newest ? newest : startedAt;
    await admin
      .from("email_connections")
      .update({ sent_synced_at: cursor })
      .eq("id", target.id);

    return { scanned: page.messages.length, linked };
  } finally {
    await mailbox.close();
  }
}

/** Every connected mailbox of one organization — used after a dossier is opened. */
export async function linkSentMailForOrganization(
  admin: Admin,
  organizationId: string,
  options?: { staleAfterMs?: number },
): Promise<void> {
  const { data } = await admin
    .from("email_connections")
    .select("id, organization_id, user_id, profile_id, sent_synced_at")
    .eq("organization_id", organizationId)
    .in("provider", [IMAP_PROVIDER, outlookOAuthProvider])
    .eq("status", "connected");

  const staleBefore = Date.now() - (options?.staleAfterMs ?? 0);
  for (const target of (data ?? []) as SentMailTarget[]) {
    const last = target.sent_synced_at ? new Date(target.sent_synced_at).getTime() : 0;
    if (last > staleBefore) continue;
    await linkSentMail(admin, target).catch((error: unknown) => {
      console.error("[broker] sent mail linking failed:", error);
    });
  }
}
