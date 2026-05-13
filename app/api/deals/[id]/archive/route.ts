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

async function loadArchiveContext(context: RouteContext) {
  const { id } = await context.params;
  const parsedDealId = dealIdSchema.safeParse(id);

  if (!parsedDealId.success) {
    return {
      error: jsonError("Dossier commercial invalide.", 400, "invalid_deal_id"),
    };
  }

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

  const userContext = await loadUserOrganizationContextWithAdmin(
    user,
    adminSupabase,
  );

  if (!userContext.membership || !userContext.organization) {
    return {
      error: jsonError(
        "Aucun espace client associé.",
        403,
        "organization_context_missing",
      ),
    };
  }

  const organizationId = userContext.organization.id;
  const dealId = parsedDealId.data;
  const { data: deal } = await adminSupabase
    .from("deals")
    .select("id, created_by")
    .eq("id", dealId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!deal) {
    return {
      error: jsonError(
        "Dossier commercial introuvable.",
        404,
        "deal_not_found",
      ),
    };
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
    return {
      error: jsonError(
        "Votre rôle ne permet pas de modifier ce dossier.",
        403,
        "insufficient_role",
      ),
    };
  }

  return {
    adminSupabase,
    dealId,
    organizationId,
    userId: user.id,
  };
}

export async function PATCH(_request: NextRequest, context: RouteContext) {
  const archiveContext = await loadArchiveContext(context);

  if ("error" in archiveContext) {
    return archiveContext.error;
  }

  const now = new Date().toISOString();
  const { error } = await archiveContext.adminSupabase
    .from("deals")
    .update({
      archived_at: now,
      updated_at: now,
    })
    .eq("id", archiveContext.dealId)
    .eq("organization_id", archiveContext.organizationId);

  if (error) {
    return jsonError("Archivage impossible.", 500, error.message);
  }

  await archiveContext.adminSupabase.from("audit_logs").insert({
    organization_id: archiveContext.organizationId,
    user_id: archiveContext.userId,
    action: "Dossier commercial archivé",
    entity_type: "deal",
    entity_id: archiveContext.dealId,
  });

  return NextResponse.json({ success: true, dealId: archiveContext.dealId });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const archiveContext = await loadArchiveContext(context);

  if ("error" in archiveContext) {
    return archiveContext.error;
  }

  const now = new Date().toISOString();
  const { error } = await archiveContext.adminSupabase
    .from("deals")
    .update({
      archived_at: null,
      updated_at: now,
    })
    .eq("id", archiveContext.dealId)
    .eq("organization_id", archiveContext.organizationId);

  if (error) {
    return jsonError("Restauration impossible.", 500, error.message);
  }

  await archiveContext.adminSupabase.from("audit_logs").insert({
    organization_id: archiveContext.organizationId,
    user_id: archiveContext.userId,
    action: "Dossier commercial restauré",
    entity_type: "deal",
    entity_id: archiveContext.dealId,
  });

  return NextResponse.json({ success: true, dealId: archiveContext.dealId });
}
