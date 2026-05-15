import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  normalizeWorkspaceRole,
  workspaceMemberRoles,
} from "@/lib/auth/workspace-permissions";
import { requireInternalAdminContext } from "@/lib/internal-admin/server";
import { isProtectedAccountEmail } from "@/lib/protected-users";

const organizationIdSchema = z.string().uuid();
const memberIdSchema = z.string().uuid();
const memberUpdateSchema = z.object({
  role: z.enum(workspaceMemberRoles),
});

type RouteContext = {
  params: Promise<{
    id: string;
    memberId: string;
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

async function countActiveManagers(
  internalAdmin: Extract<
    Awaited<ReturnType<typeof requireInternalAdminContext>>,
    { success: true }
  >,
  organizationId: string,
) {
  const { count, error } = await internalAdmin.adminSupabase
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

async function getMemberProfile(
  internalAdmin: Extract<
    Awaited<ReturnType<typeof requireInternalAdminContext>>,
    { success: true }
  >,
  userId: string,
) {
  const { data, error } = await internalAdmin.adminSupabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    profile: data,
    error,
  };
}

async function loadMember(
  internalAdmin: Extract<
    Awaited<ReturnType<typeof requireInternalAdminContext>>,
    { success: true }
  >,
  organizationId: string,
  memberId: string,
) {
  const { data: member, error: memberLookupError } =
    await internalAdmin.adminSupabase
      .from("organization_members")
      .select("id, organization_id, user_id, role, status, created_at")
      .eq("id", memberId)
      .eq("organization_id", organizationId)
      .maybeSingle();

  if (memberLookupError) {
    return {
      error: jsonError(
        "Lecture du compte impossible.",
        500,
        memberLookupError.message,
      ),
    };
  }

  if (!member) {
    return {
      error: jsonError("Compte introuvable.", 404, "member_not_found"),
    };
  }

  return { member };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id, memberId } = await context.params;
  const parsedOrganizationId = organizationIdSchema.safeParse(id);
  const parsedMemberId = memberIdSchema.safeParse(memberId);

  if (!parsedOrganizationId.success || !parsedMemberId.success) {
    return jsonError("Compte invalide.", 400, "invalid_member_id");
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = memberUpdateSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError("Rôle invalide.", 400, "invalid_payload");
  }

  const internalAdmin = await requireInternalAdminContext();

  if (!internalAdmin.success) {
    return jsonError(
      internalAdmin.message,
      internalAdmin.status,
      internalAdmin.reason,
    );
  }

  const organizationId = parsedOrganizationId.data;
  const loadedMember = await loadMember(
    internalAdmin,
    organizationId,
    parsedMemberId.data,
  );

  if ("error" in loadedMember) {
    return loadedMember.error;
  }

  const currentRole = normalizeWorkspaceRole(loadedMember.member.role);
  const nextRole = parsedBody.data.role;

  if (!currentRole) {
    return jsonError(
      "Rôle workspace non autorisé.",
      403,
      "unsupported_workspace_role",
    );
  }

  if (currentRole === "manager" && nextRole !== "manager") {
    const managers = await countActiveManagers(internalAdmin, organizationId);

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

  const { data: updatedMember, error: updateError } =
    await internalAdmin.adminSupabase
      .from("organization_members")
      .update({ role: nextRole })
      .eq("id", loadedMember.member.id)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .select("id, organization_id, user_id, role, status, created_at")
      .single();

  if (updateError || !updatedMember) {
    return jsonError(
      "Mise à jour du rôle impossible.",
      500,
      updateError?.message ?? "member_role_update_failed",
    );
  }

  const { profile, error: profileError } = await getMemberProfile(
    internalAdmin,
    updatedMember.user_id,
  );

  if (profileError) {
    return jsonError(
      "Rôle modifié, mais relecture du profil impossible.",
      500,
      profileError.message,
    );
  }

  const email = profile?.email ?? "Email inconnu";

  await internalAdmin.adminSupabase.from("audit_logs").insert({
    organization_id: organizationId,
    user_id: internalAdmin.user.id,
    action: "organization_member_role_updated",
    entity_type: "organization_member",
    entity_id: updatedMember.id,
  });

  return NextResponse.json({
    success: true,
    member: {
      id: updatedMember.id,
      userId: updatedMember.user_id,
      name: profile?.full_name?.trim() || email,
      email,
      role: normalizeWorkspaceRole(updatedMember.role) ?? "member",
      status: updatedMember.status,
      createdAt: updatedMember.created_at,
    },
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id, memberId } = await context.params;
  const parsedOrganizationId = organizationIdSchema.safeParse(id);
  const parsedMemberId = memberIdSchema.safeParse(memberId);

  if (!parsedOrganizationId.success || !parsedMemberId.success) {
    return jsonError("Compte invalide.", 400, "invalid_member_id");
  }

  const internalAdmin = await requireInternalAdminContext();

  if (!internalAdmin.success) {
    return jsonError(
      internalAdmin.message,
      internalAdmin.status,
      internalAdmin.reason,
    );
  }

  const organizationId = parsedOrganizationId.data;
  const loadedMember = await loadMember(
    internalAdmin,
    organizationId,
    parsedMemberId.data,
  );

  if ("error" in loadedMember) {
    return loadedMember.error;
  }

  const member = loadedMember.member;

  if (
    organizationId === internalAdmin.context.organization?.id &&
    member.user_id === internalAdmin.user.id
  ) {
    return jsonError(
      "Vous ne pouvez pas retirer votre propre accès admin interne.",
      403,
      "cannot_remove_self_internal_admin",
    );
  }

  const { profile, error: profileError } = await getMemberProfile(
    internalAdmin,
    member.user_id,
  );

  if (profileError) {
    return jsonError(
      "Vérification du compte impossible.",
      500,
      profileError.message,
    );
  }

  if (isProtectedAccountEmail(profile?.email)) {
    return jsonError(
      "Ce compte est protégé et ne peut pas être supprimé.",
      403,
      "protected_account",
    );
  }

  if (normalizeWorkspaceRole(member.role) === "manager") {
    const managers = await countActiveManagers(internalAdmin, organizationId);

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

  await internalAdmin.adminSupabase.from("audit_logs").insert({
    organization_id: organizationId,
    user_id: internalAdmin.user.id,
    action: "organization_member_deleted",
    entity_type: "organization_member",
    entity_id: member.id,
  });

  const { error: deleteUserError } =
    await internalAdmin.adminSupabase.auth.admin.deleteUser(member.user_id);

  if (deleteUserError) {
    return jsonError(
      "Suppression du compte Supabase Auth impossible.",
      500,
      deleteUserError.message,
    );
  }

  const [membershipsDeleteResult, profileDeleteResult] = await Promise.all([
    internalAdmin.adminSupabase
      .from("organization_members")
      .delete()
      .eq("user_id", member.user_id),
    internalAdmin.adminSupabase
      .from("profiles")
      .delete()
      .eq("user_id", member.user_id),
  ]);

  if (membershipsDeleteResult.error || profileDeleteResult.error) {
    return jsonError(
      "Compte Auth supprimé, mais nettoyage complet impossible.",
      500,
      membershipsDeleteResult.error?.message ??
        profileDeleteResult.error?.message ??
        "profile_or_membership_cleanup_failed",
    );
  }

  return NextResponse.json({
    success: true,
    memberId: member.id,
  });
}
