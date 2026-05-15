import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  OrganizationMemberRow,
  OrganizationRow,
  ProfileRow,
} from "@/types/database";

export type CurrentUserContext = {
  user: User;
  profile: ProfileRow | null;
  membership: OrganizationMemberRow | null;
  organization: OrganizationRow | null;
};

export async function loadCurrentUserContext(): Promise<CurrentUserContext | null> {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("organization_members")
      .select("id, organization_id, user_id, role, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const { data: organization } = membership
    ? await supabase
        .from("organizations")
        .select("*")
        .eq("id", membership.organization_id)
        .maybeSingle()
    : { data: null };

  return {
    user,
    profile: profile ?? null,
    membership: membership ?? null,
    organization: organization ?? null,
  };
}

export const getCurrentUserContext = cache(loadCurrentUserContext);

export async function requireCurrentUserContext() {
  const context = await getCurrentUserContext();

  if (!context) {
    redirect("/login");
  }

  return context;
}

export async function requireActiveWorkspaceContext() {
  const context = await requireCurrentUserContext();

  if (!context.membership || !context.organization) {
    redirect("/no-access");
  }

  return context;
}
