import { NextResponse } from "next/server";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { outlookOAuthProvider } from "@/lib/email/microsoft-oauth";
import { decryptToken } from "@/lib/email/token-crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

async function loadConnectionContext() {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return {
      error: jsonError("Opération indisponible.", 500, "supabase_unconfigured"),
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: jsonError("Session requise.", 401, "session_missing"),
    };
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return {
      error: jsonError(
        "Opération indisponible.",
        500,
        "service_role_unconfigured",
      ),
    };
  }

  const context = await loadUserOrganizationContextWithAdmin(
    user,
    adminSupabase,
  );

  if (!context.organization || !context.membership) {
    return {
      error: jsonError(
        "Aucun espace client associé.",
        403,
        "organization_context_missing",
      ),
    };
  }

  return {
    adminSupabase,
    organizationId: context.organization.id,
    userId: user.id,
  };
}

export async function GET() {
  const context = await loadConnectionContext();

  if ("error" in context) {
    return context.error;
  }

  const { data: connection } = await context.adminSupabase
    .from("email_connections")
    .select("id, email, provider, status, expires_at, updated_at")
    .eq("organization_id", context.organizationId)
    .eq("user_id", context.userId)
    .eq("provider", outlookOAuthProvider)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    connection: connection
      ? {
          id: connection.id,
          provider: connection.provider,
          email: connection.email,
          status: connection.status,
          expiresAt: connection.expires_at,
          updatedAt: connection.updated_at,
        }
      : null,
  });
}

export async function DELETE() {
  const context = await loadConnectionContext();

  if ("error" in context) {
    return context.error;
  }

  const { data: connection, error: readError } = await context.adminSupabase
    .from("email_connections")
    .select("id, refresh_token")
    .eq("organization_id", context.organizationId)
    .eq("user_id", context.userId)
    .eq("provider", outlookOAuthProvider)
    .maybeSingle();

  if (readError) {
    return jsonError("Lecture impossible.", 500, readError.message);
  }

  if (!connection) {
    return NextResponse.json({ success: true });
  }

  try {
    // Decrypt to validate the token is readable; Microsoft has no revocation endpoint.
    decryptToken(connection.refresh_token);
  } catch {
    // Continue with deletion even if decryption fails.
  }

  const { error } = await context.adminSupabase
    .from("email_connections")
    .delete()
    .eq("id", connection.id)
    .eq("organization_id", context.organizationId)
    .eq("user_id", context.userId);

  if (error) {
    return jsonError("Déconnexion impossible.", 500, error.message);
  }

  await context.adminSupabase.from("audit_logs").insert({
    organization_id: context.organizationId,
    user_id: context.userId,
    action: "email_provider_disconnected",
    entity_type: "email_connection",
    entity_id: connection.id,
  });

  return NextResponse.json({ success: true });
}
