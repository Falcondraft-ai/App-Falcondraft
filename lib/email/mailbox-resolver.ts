import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ImapMailboxClient, type ImapConfig } from "@/lib/email/imap-client";
import { createOutlookDraft } from "@/lib/email/outlook-drafts";
import type {
  MailAttachmentMeta,
  MailDraft,
  MailDraftResult,
  MailMessage,
  MailMessageBody,
  MailSearchCriteria,
  MailboxClient,
  MailboxPage,
} from "@/lib/email/mailbox";
import { outlookOAuthProvider } from "@/lib/email/microsoft-oauth";
import {
  getFileAttachmentBytes,
  getMailboxAddresses,
  getMessageAttachmentsMeta,
  getOutlookAccessForUser,
  getOutlookMessageBody,
  listRecentInboxMessages,
  searchMessagesForClient,
} from "@/lib/email/outlook-read";
import { decryptToken } from "@/lib/email/token-crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, EmailConnectionRow } from "@/types/database";

export const IMAP_PROVIDER = "imap";

/* -------------------------------------------------------------------------- */
/*  Adaptateur Microsoft                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Boîte Microsoft 365, derrière l'interface commune. Les appels Graph sont sans
 * état : rien à ouvrir, rien à fermer.
 */
class OutlookMailboxClient implements MailboxClient {
  readonly provider = "outlook" as const;
  readonly address: string;
  addresses: string[];

  private readonly accessToken: string;
  private readonly organizationId: string;
  private readonly userId: string;

  constructor(
    accessToken: string,
    address: string,
    addresses: string[],
    organizationId: string,
    userId: string,
  ) {
    this.accessToken = accessToken;
    this.address = address.trim().toLowerCase();
    this.addresses = addresses.length > 0 ? addresses : [this.address];
    this.organizationId = organizationId;
    this.userId = userId;
  }

  listInbox(
    sinceIso: string,
    max: number,
    options?: { order?: "asc" | "desc" },
  ): Promise<MailboxPage> {
    return listRecentInboxMessages(this.accessToken, sinceIso, max, options);
  }

  getBody(messageId: string): Promise<MailMessageBody | null> {
    return getOutlookMessageBody(this.accessToken, messageId);
  }

  listAttachments(messageId: string): Promise<MailAttachmentMeta[]> {
    return getMessageAttachmentsMeta(this.accessToken, messageId);
  }

  async getAttachmentBytes(messageId: string, attachmentId: string) {
    const file = await getFileAttachmentBytes(
      this.accessToken,
      messageId,
      attachmentId,
    );
    return file ?? null;
  }

  searchForClient(
    criteria: MailSearchCriteria,
    query?: string,
    max?: number,
  ): Promise<MailMessage[]> {
    return searchMessagesForClient(this.accessToken, criteria, query, max);
  }

  async createDraft(draft: MailDraft): Promise<MailDraftResult> {
    // On délègue au flux Graph existant : il gère l'envoi des pièces jointes
    // volumineuses (sessions d'upload) qu'un simple POST ne couvre pas.
    try {
      const result = await createOutlookDraft({
        organizationId: this.organizationId,
        userId: this.userId,
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
        cc: draft.cc,
        attachments: draft.attachments?.map((a) => ({
          filename: a.filename,
          contentType: "application/pdf" as const,
          contentBase64: a.contentBase64,
        })),
      });
      return { ok: true, draftId: result.draftId, email: result.email };
    } catch (error) {
      console.error("[outlook] draft failed:", error);
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Le brouillon n’a pas pu être créé dans la boîte.",
      };
    }
  }

  async close(): Promise<void> {
    // Sans objet : Graph est du HTTP sans état.
  }
}

/* -------------------------------------------------------------------------- */
/*  Connexion IMAP                                                            */
/* -------------------------------------------------------------------------- */

type ImapConnectionRow = Pick<
  EmailConnectionRow,
  | "id"
  | "email"
  | "access_token"
  | "imap_host"
  | "imap_port"
  | "imap_secure"
  | "smtp_host"
  | "smtp_port"
  | "smtp_secure"
  | "username"
>;

/** Reconstruit une configuration IMAP exploitable à partir de la ligne stockée. */
export function toImapConfig(row: ImapConnectionRow): ImapConfig | null {
  if (!row.imap_host || !row.imap_port) return null;
  let password: string;
  try {
    password = decryptToken(row.access_token);
  } catch (error) {
    // Clé de chiffrement changée ou donnée corrompue : mieux vaut une boîte
    // déclarée injoignable qu'une tentative de connexion avec un secret bancal.
    console.error("[imap] secret decryption failed:", error);
    return null;
  }

  return {
    host: row.imap_host,
    port: row.imap_port,
    secure: row.imap_secure,
    user: row.username || row.email,
    password,
    address: row.email,
    smtp:
      row.smtp_host && row.smtp_port
        ? { host: row.smtp_host, port: row.smtp_port, secure: row.smtp_secure }
        : null,
  };
}

const IMAP_COLUMNS =
  "id, email, access_token, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, username";

/* -------------------------------------------------------------------------- */
/*  Résolution                                                                */
/* -------------------------------------------------------------------------- */

export type MailboxTarget = {
  organizationId: string;
  userId: string;
  /** Profil de cabinet dont on veut la boîte (null = boîte du compte). */
  profileId?: string | null;
  adminSupabase?: SupabaseClient<Database>;
};

/**
 * Rend la boîte à utiliser, quel que soit l'hébergeur.
 *
 * Ordre de résolution volontaire : la connexion IMAP du PROFIL d'abord. Un
 * cabinet qui a rattaché une adresse à chaque personne veut que chacun voie sa
 * propre boîte, pas celle du compte. À défaut, on retombe sur la connexion
 * Microsoft, qui reste le cas des cabinets hébergés chez Microsoft 365.
 *
 * L'appelant DOIT appeler `close()` : en IMAP une connexion reste ouverte.
 */
export async function getMailboxClient(
  target: MailboxTarget,
): Promise<MailboxClient | null> {
  const admin = target.adminSupabase ?? getSupabaseAdminClient();
  if (!admin) return null;

  // La boîte d'un profil appartient au cabinet, pas au compte qui l'a reliée :
  // on ne filtre PAS sur user_id quand un profil est en jeu. Sans quoi deux
  // logins du même cabinet ne verraient pas la même boîte (voir migration 0059).
  let query = admin
    .from("email_connections")
    .select(IMAP_COLUMNS)
    .eq("organization_id", target.organizationId)
    .eq("provider", IMAP_PROVIDER)
    .eq("status", "connected");

  query = target.profileId
    ? query.eq("profile_id", target.profileId)
    : query.eq("user_id", target.userId).is("profile_id", null);

  const { data: imapRow } = await query.maybeSingle();

  if (imapRow) {
    const config = toImapConfig(imapRow as ImapConnectionRow);
    if (config) return new ImapMailboxClient(config);
  }

  const access = await getOutlookAccessForUser(
    target.organizationId,
    target.userId,
  );
  if (!access) return null;

  const addresses = await getMailboxAddresses(access.accessToken);
  return new OutlookMailboxClient(
    access.accessToken,
    access.email,
    addresses,
    target.organizationId,
    target.userId,
  );
}

/**
 * Y a-t-il une boîte utilisable pour ce profil ? Simple lecture en base : sert
 * à décider ce qu'affiche une page, sans ouvrir de session IMAP pour rien.
 */
export async function hasConnectedMailbox(target: {
  organizationId: string;
  userId: string;
  profileId?: string | null;
  adminSupabase?: SupabaseClient<Database>;
}): Promise<{ connected: boolean; email: string | null; provider: string | null }> {
  const admin = target.adminSupabase ?? getSupabaseAdminClient();
  if (!admin) return { connected: false, email: null, provider: null };

  let imap = admin
    .from("email_connections")
    .select("email, provider")
    .eq("organization_id", target.organizationId)
    .eq("provider", IMAP_PROVIDER)
    .eq("status", "connected");
  // Même règle que ci-dessus : la boîte suit le profil, pas le login.
  imap = target.profileId
    ? imap.eq("profile_id", target.profileId)
    : imap.eq("user_id", target.userId).is("profile_id", null);

  const { data: imapRow } = await imap.maybeSingle();
  if (imapRow) {
    return { connected: true, email: imapRow.email, provider: imapRow.provider };
  }

  // Repli : la connexion Microsoft du compte, partagée par tous les profils.
  const { data: oauthRow } = await admin
    .from("email_connections")
    .select("email, provider")
    .eq("organization_id", target.organizationId)
    .eq("user_id", target.userId)
    .eq("provider", outlookOAuthProvider)
    .eq("status", "connected")
    .maybeSingle();

  return oauthRow
    ? { connected: true, email: oauthRow.email, provider: oauthRow.provider }
    : { connected: false, email: null, provider: null };
}

/**
 * Boîtes connectées d'une organisation, une par profil — c'est ce qui permet au
 * cron de produire un briefing par personne.
 */
export async function listConnectedMailboxes(
  adminSupabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<{ userId: string; profileId: string | null; provider: string; email: string }[]> {
  const { data } = await adminSupabase
    .from("email_connections")
    .select("user_id, profile_id, provider, email")
    .eq("organization_id", organizationId)
    .eq("status", "connected")
    .in("provider", [IMAP_PROVIDER, outlookOAuthProvider]);

  return (data ?? []).map((row) => ({
    userId: row.user_id,
    profileId: row.profile_id,
    provider: row.provider,
    email: row.email,
  }));
}
