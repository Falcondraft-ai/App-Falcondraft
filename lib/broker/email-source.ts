import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveBrokerProfile } from "@/lib/broker/profiles";
import type { MailboxClient } from "@/lib/email/mailbox";
import { getMailboxClient } from "@/lib/email/mailbox-resolver";
import type { Database } from "@/types/database";

/**
 * Where a dossier email is read from.
 *
 * A dossier shows the whole cabinet's correspondence with the client: an email
 * Stephan sent sits in Stephan's mailbox, and must still open when Frank is the
 * active profile.
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
