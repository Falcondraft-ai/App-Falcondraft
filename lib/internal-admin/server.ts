import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import type { CurrentUserContext } from "@/lib/auth/session";
import { canViewInternalAdmin } from "@/lib/internal-access";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type InternalAdminContext = {
  adminSupabase: SupabaseClient<Database>;
  context: CurrentUserContext;
  user: User;
};

export type InternalAdminError = {
  success: false;
  status: number;
  message: string;
  reason: string;
};

export type InternalAdminResult =
  | ({ success: true } & InternalAdminContext)
  | InternalAdminError;

export async function requireInternalAdminContext(): Promise<InternalAdminResult> {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return {
      success: false,
      status: 500,
      message: "Configuration Supabase manquante.",
      reason: "supabase_unconfigured",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      status: 401,
      message: "Session requise.",
      reason: "session_missing",
    };
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return {
      success: false,
      status: 500,
      message: "Configuration admin Supabase manquante.",
      reason: "service_role_unconfigured",
    };
  }

  const context = await loadUserOrganizationContextWithAdmin(
    user,
    adminSupabase,
  );

  if (!canViewInternalAdmin(context)) {
    return {
      success: false,
      status: 403,
      message: "Accès réservé aux administrateurs internes FalconDraft.",
      reason: "internal_admin_required",
    };
  }

  return {
    success: true,
    adminSupabase,
    context,
    user,
  };
}
