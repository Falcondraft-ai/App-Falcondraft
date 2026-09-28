import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import { getActiveBrokerProfile } from "@/lib/broker/profiles";
import {
  emailFileKind,
  parseEmailFile,
  type ParsedEmailFile,
} from "@/lib/email/email-file";
import type { MailboxClient } from "@/lib/email/mailbox";
import { getMailboxClient } from "@/lib/email/mailbox-resolver";
import type { Database } from "@/types/database";

/**
 * Where a dossier email is read from.
 *
 * A dossier shows the whole cabinet's correspondence with the client: an email
 * Stephan sent sits in Stephan's mailbox, and must still open when Frank is the
 * active profile. And an email dropped as a file has no mailbox at all — it is
 * read from its copy in the GED.
 */
type Caller = {
  adminSupabase: SupabaseClient<Database>;
  organizationId: string;
  user: { id: string };
};

/**
 * The mailbox holding the message: the given profile's when it belongs to the
 * organization, the active profile's otherwise (legacy links carry no profile).
 */
export async function openEmailMailbox(
  caller: Caller,
  profileId: string | null | undefined,
): Promise<MailboxClient | null> {
  let resolved: string | null = null;
  if (profileId) {
    const { data } = await caller.adminSupabase
      .from("broker_profiles")
      .select("id")
      .eq("organization_id", caller.organizationId)
      .eq("id", profileId)
      .maybeSingle();
    resolved = data?.id ?? null;
  }
  if (!resolved) {
    resolved = (await getActiveBrokerProfile(caller.organizationId))?.id ?? null;
  }
  return getMailboxClient({
    organizationId: caller.organizationId,
    userId: caller.user.id,
    profileId: resolved,
    adminSupabase: caller.adminSupabase,
  });
}

/** A filed .eml/.msg, read back from the organization's GED. */
export async function loadFiledEmail(
  caller: Caller,
  documentId: string,
): Promise<ParsedEmailFile | null> {
  const { data: doc } = await caller.adminSupabase
    .from("broker_documents")
    .select("storage_path, file_name")
    .eq("organization_id", caller.organizationId)
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return null;

  const { data: file } = await caller.adminSupabase.storage
    .from(BROKER_FILES_BUCKET)
    .download(doc.storage_path);
  if (!file) return null;

  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = emailFileKind(doc.file_name, bytes);
  if (!kind) return null;
  try {
    return await parseEmailFile(bytes, kind);
  } catch (error) {
    console.error("[broker] email file unreadable:", error);
    return null;
  }
}
