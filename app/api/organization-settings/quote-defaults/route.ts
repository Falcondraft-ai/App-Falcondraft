import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { canManageWorkspaceSettings } from "@/lib/auth/workspace-permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const quoteDefaultsSchema = z.object({
  default_quote_client_type: z.enum(["company", "individual"]),
  default_quote_tax_rate: z.number().refine(
    (v) => [0, 5.5, 10, 20].includes(v),
    { message: "Taux de TVA invalide." },
  ),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function PATCH(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return jsonError("Operation indisponible.", 500, "supabase_unconfigured");
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
      "Operation indisponible.",
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
      "Aucun espace client associe.",
      403,
      "organization_context_missing",
    );
  }

  if (!canManageWorkspaceSettings(context.membership.role)) {
    return jsonError(
      "Acces reserve aux gestionnaires.",
      403,
      "insufficient_role",
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = quoteDefaultsSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError("Preferences invalides.", 400, "invalid_payload");
  }

  const { error } = await adminSupabase
    .from("organizations")
    .update({
      default_quote_client_type:
        parsedBody.data.default_quote_client_type,
      default_quote_tax_rate:
        parsedBody.data.default_quote_tax_rate,
    })
    .eq("id", context.organization.id);

  if (error) {
    console.error("[quote-defaults] update failed:", error.message);
    return jsonError("Mise a jour impossible.", 500, "db_error");
  }

  await adminSupabase.from("audit_logs").insert({
    organization_id: context.organization.id,
    user_id: user.id,
    action: "organization_quote_defaults_updated",
    entity_type: "organization",
    entity_id: context.organization.id,
  });

  return NextResponse.json({
    success: true,
    default_quote_client_type:
      parsedBody.data.default_quote_client_type,
    default_quote_tax_rate:
      parsedBody.data.default_quote_tax_rate,
  });
}
