import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { CurrentUserContext } from "@/lib/auth/session";
import type { Database } from "@/types/database";

const membershipSelect =
  "id, organization_id, user_id, role, status, created_at";

export async function loadUserOrganizationContextWithAdmin(
  user: User,
  supabase: SupabaseClient<Database>,
): Promise<CurrentUserContext> {
  const [profileResult, membershipResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_members")
      .select(membershipSelect)
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1),
  ]);

  const membershipRows = membershipResult.data ?? [];
  const membership = membershipRows[0] ?? null;

  const { data: organization } = membership
    ? await supabase
        .from("organizations")
        .select("*")
        .eq("id", membership.organization_id)
        .maybeSingle()
    : { data: null };

  return {
    user,
    profile: profileResult.data ?? null,
    membership,
    organization: organization ?? null,
  };
}
