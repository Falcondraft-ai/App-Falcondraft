import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { canManageWorkspaceSettings } from "@/lib/auth/workspace-permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const visibilitySchema = z.object({
  allow_member_company_visibility: z.boolean(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function PATCH(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return jsonError("Opération indisponible.", 500, "supabase_unconfigured");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Session requise.", 401, "session_missing");
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return jsonError(
      "Opération indisponible.",
      500,
      "service_role_unconfigured",
    );
  }

  const context = await loadUserOrganizationContextWithAdmin(
    user,
    adminSupabase,
  );

  if (!context.membership || !context.organization) {
    return jsonError(
      "Aucun espace client associé.",
      403,
      "organization_context_missing",
    );
  }

  if (!canManageWorkspaceSettings(context.membership.role)) {
    return jsonError(
      "Accès réservé aux gestionnaires.",
      403,
      "insufficient_role",
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = visibilitySchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError("Préférence invalide.", 400, "invalid_payload");
  }

  const { error } = await adminSupabase
    .from("organizations")
    .update({
      allow_member_company_visibility:
        parsedBody.data.allow_member_company_visibility,
    })
    .eq("id", context.organization.id);

  if (error) {
    console.error("[visibility] update failed:", error.message);
    return jsonError("Mise à jour impossible.", 500, "db_error");
  }

  await adminSupabase.from("audit_logs").insert({
    organization_id: context.organization.id,
    user_id: user.id,
    action: "organization_visibility_updated",
    entity_type: "organization",
    entity_id: context.organization.id,
  });

  return NextResponse.json({
    success: true,
    allow_member_company_visibility:
      parsedBody.data.allow_member_company_visibility,
  });
}
