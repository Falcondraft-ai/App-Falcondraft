import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import type { CurrentUserContext } from "@/lib/auth/session";
import { isBrokerWorkspace } from "@/lib/broker/access";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type BrokerApiContext = {
  adminSupabase: SupabaseClient<Database>;
  context: CurrentUserContext;
  user: User;
  organizationId: string;
};

export type BrokerApiError = {
  success: false;
  status: number;
  message: string;
  reason: string;
};

export type BrokerApiResult =
  | ({ success: true } & BrokerApiContext)
  | BrokerApiError;

/**
 * Resolves and authorizes the current user for the insurance-broker module.
 * The organization is taken from the trusted server context — never from the
 * request body — preserving multi-tenant isolation.
 */
export async function requireBrokerApiContext(): Promise<BrokerApiResult> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return {
      success: false,
      status: 500,
      message: "Service indisponible.",
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
      message: "Service indisponible.",
      reason: "service_role_unconfigured",
    };
  }

  const context = await loadUserOrganizationContextWithAdmin(
    user,
    adminSupabase,
  );

  if (!context.membership || !context.organization) {
    return {
      success: false,
      status: 403,
      message: "Aucun espace courtier associé.",
      reason: "active_membership_missing",
    };
  }

  if (!isBrokerWorkspace(context.organization)) {
    return {
      success: false,
      status: 403,
      message: "Espace de travail non courtier.",
      reason: "not_broker_workspace",
    };
  }

  return {
    success: true,
    adminSupabase,
    context,
    user,
    organizationId: context.organization.id,
  };
}

/**
 * Adjusts the workspace storage counter (clamped at 0). Uses a direct
 * read-modify-write via the service-role client — reliable for this workload and
 * free of any SQL-function/schema-cache dependency. Best-effort: never throws,
 * so a counter hiccup can't break an upload or delete.
 */
export async function adjustOrganizationStorage(
  adminSupabase: SupabaseClient<Database>,
  organizationId: string,
  deltaBytes: number,
): Promise<void> {
  if (!deltaBytes) return;
  try {
    const { data: org, error: readError } = await adminSupabase
      .from("organizations")
      .select("storage_used_bytes")
      .eq("id", organizationId)
      .maybeSingle();

    if (readError || !org) {
      console.error(
        "[broker] storage counter read failed:",
        readError?.message ?? "organization_not_found",
      );
      return;
    }

    const next = Math.max(0, (org.storage_used_bytes ?? 0) + deltaBytes);

    const { error: writeError } = await adminSupabase
      .from("organizations")
      .update({ storage_used_bytes: next })
      .eq("id", organizationId);

    if (writeError) {
      console.error(
        "[broker] storage counter write failed:",
        writeError.message,
      );
    }
  } catch (err) {
    console.error("[broker] storage counter update threw:", err);
  }
}

/** Records an entry in the per-client activity timeline (best-effort). */
export async function logBrokerActivity(
  adminSupabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    clientId: string;
    userId: string | null;
    type: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await adminSupabase.from("broker_activity").insert({
    organization_id: params.organizationId,
    client_id: params.clientId,
    user_id: params.userId,
    type: params.type,
    description: params.description ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error("[broker] Failed to log activity:", error.message);
  }
}
