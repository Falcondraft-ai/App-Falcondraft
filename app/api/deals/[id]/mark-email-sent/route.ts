import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { canMutateWorkspaceDeal } from "@/lib/auth/workspace-permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const dealIdSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const parsedDealId = dealIdSchema.safeParse(id);

  if (!parsedDealId.success) {
    return jsonError("Dossier commercial invalide.", 400, "invalid_deal_id");
  }

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

  const userContext = await loadUserOrganizationContextWithAdmin(
    user,
    adminSupabase,
  );

  if (!userContext.membership || !userContext.organization) {
    return jsonError(
      "Aucun espace client associé.",
      403,
      "organization_context_missing",
    );
  }

  const organizationId = userContext.organization.id;
  const dealId = parsedDealId.data;

  const { data: deal } = await adminSupabase
    .from("deals")
    .select("id, status, created_by")
    .eq("id", dealId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!deal) {
    return jsonError("Dossier commercial introuvable.", 404, "deal_not_found");
  }

  if (
    !canMutateWorkspaceDeal(
      {
        userId: user.id,
        role: userContext.membership.role,
        allowMemberCompanyVisibility:
          userContext.organization.allow_member_company_visibility,
        scope: "organization",
      },
      deal.created_by,
    )
  ) {
    return jsonError(
      "Votre rôle ne permet pas de modifier ce dossier.",
      403,
      "insufficient_role",
    );
  }

  if (deal.status !== "email_draft_ready") {
    return jsonError(
      "Le brouillon email doit être prêt avant marquage.",
      409,
      "invalid_status",
    );
  }

  const now = new Date().toISOString();
  const { error } = await adminSupabase
    .from("deals")
    .update({
      status: "completed",
      updated_at: now,
    })
    .eq("id", dealId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[mark-email-sent] update failed:", error.message);
    return jsonError("Marquage impossible.", 500, "db_error");
  }

  await adminSupabase.from("audit_logs").insert({
    organization_id: organizationId,
    user_id: user.id,
    action: "Email envoyé (statut manuel)",
    entity_type: "deal",
    entity_id: dealId,
  });

  return NextResponse.json({ success: true, dealId });
}
