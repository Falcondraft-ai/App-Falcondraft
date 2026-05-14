import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import {
  canManageWorkspace,
  normalizeWorkspaceRole,
  workspaceMemberRoles,
  type WorkspaceMemberRole,
} from "@/lib/auth/workspace-permissions";
import { getWorkspaceRoleLabel } from "@/lib/invitations/shared";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const memberIdSchema = z.string().uuid();
const updateMemberSchema = z.object({
  role: z.enum(workspaceMemberRoles),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

async function loadMemberMutationContext(context: RouteContext) {
  const { id } = await context.params;
  const parsedMemberId = memberIdSchema.safeParse(id);

  if (!parsedMemberId.success) {
    return {
      error: jsonError("Membre invalide.", 400, "invalid_member_id"),
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

  if (!canManageWorkspace(userContext.membership.role)) {
    return {
      error: jsonError(
        "Accès réservé aux gestionnaires.",
        403,
        "insufficient_role",
      ),
    };
  }

  const { data: targetMember, error: memberError } = await adminSupabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, status, created_at")
    .eq("id", parsedMemberId.data)
    .eq("organization_id", userContext.organization.id)
    .maybeSingle();

  if (memberError) {
    return {
      error: jsonError(
        "Lecture du membre impossible.",
        500,
        memberError.message,
      ),
    };
  }

  if (!targetMember || targetMember.status !== "active") {
    return {
      error: jsonError("Membre actif introuvable.", 404, "member_not_found"),
    };
  }

  const actorRole = normalizeWorkspaceRole(userContext.membership.role);
  const targetRole = normalizeWorkspaceRole(targetMember.role);

  if (!actorRole || !targetRole) {
    return {
      error: jsonError(
        "Rôle workspace non autorisé.",
        403,
        "unsupported_workspace_role",
      ),
    };
  }

  return {
    adminSupabase,
    actorUserId: user.id,
    actorRole,
    organizationId: userContext.organization.id,
    targetMember,
    targetRole,
  };
}

async function countActiveManagers(
  adminSupabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  organizationId: string,
) {
  const { count, error } = await adminSupabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("role", "manager");

  return {
    count: count ?? 0,
    error,
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const mutationContext = await loadMemberMutationContext(context);

  if ("error" in mutationContext) {
    return mutationContext.error;
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = updateMemberSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError("Rôle invalide.", 400, "invalid_payload");
  }

  const nextRole: WorkspaceMemberRole = parsedBody.data.role;

  if (mutationContext.targetRole === "manager" && nextRole !== "manager") {
    const managers = await countActiveManagers(
      mutationContext.adminSupabase,
      mutationContext.organizationId,
    );

    if (managers.error) {
      return jsonError(
        "Vérification des gestionnaires impossible.",
        500,
        managers.error.message,
      );
    }

    if (managers.count <= 1) {
      return jsonError(
        "Impossible de retirer le dernier gestionnaire actif.",
        409,
        "last_manager",
      );
    }
  }

  const { data: updatedMember, error } = await mutationContext.adminSupabase
    .from("organization_members")
    .update({
      role: nextRole,
    })
    .eq("id", mutationContext.targetMember.id)
    .eq("organization_id", mutationContext.organizationId)
    .eq("status", "active")
    .select("id, organization_id, user_id, role, status, created_at")
    .single();

  if (error || !updatedMember) {
    return jsonError(
      "Mise à jour impossible.",
      500,
      error?.message ?? "update_failed",
    );
  }

  await mutationContext.adminSupabase.from("audit_logs").insert({
    organization_id: mutationContext.organizationId,
    user_id: mutationContext.actorUserId,
    action: "organization_member_role_updated",
    entity_type: "organization_member",
    entity_id: updatedMember.id,
  });

  return NextResponse.json({
    success: true,
    member: {
      id: updatedMember.id,
      userId: updatedMember.user_id,
      role: getWorkspaceRoleLabel(updatedMember.role),
      roleKey: normalizeWorkspaceRole(updatedMember.role) ?? "member",
      status: "Actif",
      lastActiveAt: updatedMember.created_at,
    },
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const mutationContext = await loadMemberMutationContext(context);

  if ("error" in mutationContext) {
    return mutationContext.error;
  }

  if (mutationContext.targetRole === "manager") {
    const managers = await countActiveManagers(
      mutationContext.adminSupabase,
      mutationContext.organizationId,
    );

    if (managers.error) {
      return jsonError(
        "Vérification des gestionnaires impossible.",
        500,
        managers.error.message,
      );
    }

    if (managers.count <= 1) {
      return jsonError(
        "Impossible de retirer le dernier gestionnaire actif.",
        409,
        "last_manager",
      );
    }
  }

  const { data: deactivatedMember, error } = await mutationContext.adminSupabase
    .from("organization_members")
    .update({
      status: "inactive",
    })
    .eq("id", mutationContext.targetMember.id)
    .eq("organization_id", mutationContext.organizationId)
    .eq("status", "active")
    .select("id")
    .single();

  if (error || !deactivatedMember) {
    return jsonError(
      "Retrait impossible.",
      500,
      error?.message ?? "deactivation_failed",
    );
  }

  await mutationContext.adminSupabase.from("audit_logs").insert({
    organization_id: mutationContext.organizationId,
    user_id: mutationContext.actorUserId,
    action: "member_deactivated",
    entity_type: "organization_member",
    entity_id: deactivatedMember.id,
  });

  return NextResponse.json({
    success: true,
  });
}
