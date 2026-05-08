import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const dealIdSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json(
    {
      success: false,
      message,
      reason,
    },
    { status },
  );
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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
    .select("id, call_summary")
    .eq("id", dealId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!deal) {
    return jsonError("Dossier commercial introuvable.", 404, "deal_not_found");
  }

  const { error } = await adminSupabase
    .from("deals")
    .update({
      proposal_content: null,
      status: deal.call_summary ? "call_summary_ready" : "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId)
    .eq("organization_id", organizationId);

  if (error) {
    return jsonError("Suppression impossible.", 500, error.message);
  }

  await adminSupabase.from("audit_logs").insert({
    organization_id: organizationId,
    user_id: user.id,
    action: "Proposition supprimée",
    entity_type: "deal",
    entity_id: dealId,
  });

  return NextResponse.json({
    success: true,
    dealId,
  });
}
