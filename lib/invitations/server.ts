import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type {
  Database,
  OrganizationInvitationRow,
  OrganizationMemberRow,
  OrganizationRow,
  ProfileRow,
} from "@/types/database";
import {
  canManageWorkspaceInvitations,
  normalizeEmail,
  type InvitationLookupResult,
} from "@/lib/invitations/shared";
import { hashInvitationToken } from "@/lib/invitations/tokens";

export type InvitationMutationClient = SupabaseClient<Database>;

type InvitationLookupRecord = OrganizationInvitationRow & {
  organization: Pick<OrganizationRow, "id" | "name">;
};

export type ManageOrganizationResult =
  | {
      success: true;
      membership: OrganizationMemberRow;
      organization: OrganizationRow;
    }
  | {
      success: false;
      status: number;
      message: string;
      reason: string;
    };

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

export async function assertCanManageOrganization(
  supabase: InvitationMutationClient,
  userId: string,
  organizationId: string,
): Promise<ManageOrganizationResult> {
  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, status, created_at")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    return {
      success: false,
      status: 500,
      message: "Vérification des droits impossible.",
      reason: membershipError.message,
    };
  }

  if (!membership || !canManageWorkspaceInvitations(membership.role)) {
    return {
      success: false,
      status: 403,
      message: "Accès réservé aux gestionnaires actifs.",
      reason: "insufficient_role",
    };
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) {
    return {
      success: false,
      status: 500,
      message: "Vérification de l’organisation impossible.",
      reason: organizationError.message,
    };
  }

  if (!organization) {
    return {
      success: false,
      status: 404,
      message: "Organisation introuvable.",
      reason: "organization_not_found",
    };
  }

  return {
    success: true,
    membership,
    organization,
  };
}

export async function isActiveOrganizationMemberEmail(
  supabase: InvitationMutationClient,
  organizationId: string,
  email: string,
) {
  const normalizedEmail = normalizeEmail(email);

  const { data: members, error: membersError } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, status, created_at")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (membersError) {
    return {
      success: false,
      message: membersError.message,
      isMember: false,
    };
  }

  if (!members || members.length === 0) {
    return {
      success: true,
      isMember: false,
    };
  }

  const memberIds = members.map((member) => member.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .in("user_id", memberIds);

  if (profilesError) {
    return {
      success: false,
      message: profilesError.message,
      isMember: false,
    };
  }

  const profileByUserId = new Map(
    (profiles ?? []).map((profile: ProfileRow) => [profile.user_id, profile]),
  );

  if (
    members.some((member) => {
      const profile = profileByUserId.get(member.user_id);
      return profile
        ? normalizeEmail(profile.email) === normalizedEmail
        : false;
    })
  ) {
    return {
      success: true,
      isMember: true,
    };
  }

  const authUsers = await Promise.all(
    members.map((member) => supabase.auth.admin.getUserById(member.user_id)),
  );

  const isMember = authUsers.some(
    (result) =>
      result.data.user?.email &&
      normalizeEmail(result.data.user.email) === normalizedEmail,
  );

  return {
    success: true,
    isMember,
  };
}

export async function getPendingInvitationByEmail(
  supabase: InvitationMutationClient,
  organizationId: string,
  email: string,
) {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("organization_invitations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .gt("expires_at", now)
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(1);

  return {
    invitation: data?.[0] ?? null,
    error,
  };
}

export async function expirePendingInvitationsForEmail(
  supabase: InvitationMutationClient,
  organizationId: string,
  email: string,
) {
  const now = new Date().toISOString();

  await supabase
    .from("organization_invitations")
    .update({
      status: "expired",
      updated_at: now,
    })
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .lte("expires_at", now)
    .eq("email", normalizeEmail(email));
}

export async function findInvitationByToken(
  supabase: InvitationMutationClient,
  token: string,
): Promise<InvitationLookupRecord | null> {
  const tokenHash = hashInvitationToken(token);
  const { data: invitation } = await supabase
    .from("organization_invitations")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invitation) {
    return null;
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", invitation.organization_id)
    .maybeSingle();

  if (!organization) {
    return null;
  }

  return {
    ...invitation,
    organization,
  };
}

export async function lookupInvitationByToken(
  supabase: InvitationMutationClient,
  token: string | null,
): Promise<InvitationLookupResult> {
  if (!token?.trim()) {
    return {
      valid: false,
      state: "missing",
      invitation: null,
    };
  }

  const invitation = await findInvitationByToken(supabase, token);

  if (!invitation) {
    return {
      valid: false,
      state: "invalid",
      invitation: null,
    };
  }

  const publicInvitation = {
    organizationName: invitation.organization.name,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expires_at,
  };

  if (invitation.status === "revoked") {
    return {
      valid: false,
      state: "revoked",
      invitation: publicInvitation,
    };
  }

  if (invitation.status === "accepted") {
    return {
      valid: false,
      state: "accepted",
      invitation: publicInvitation,
    };
  }

  if (invitation.status !== "pending") {
    return {
      valid: false,
      state: "invalid",
      invitation: publicInvitation,
    };
  }

  if (isExpired(invitation.expires_at)) {
    return {
      valid: false,
      state: "expired",
      invitation: publicInvitation,
    };
  }

  return {
    valid: true,
    state: "valid",
    invitation: publicInvitation,
  };
}

export async function ensureProfileForUser(
  supabase: InvitationMutationClient,
  user: Pick<User, "id" | "email" | "user_metadata">,
  fullName?: string | null,
) {
  const email = normalizeEmail(user.email ?? "");
  const trimmedFullName = fullName?.trim() || null;

  if (!email) {
    return {
      success: false,
      message: "Email utilisateur introuvable.",
    };
  }

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileLookupError) {
    return {
      success: false,
      message: profileLookupError.message,
    };
  }

  const metadataFullName =
    typeof user.user_metadata.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : null;
  const fullNameValue =
    trimmedFullName || existingProfile?.full_name || metadataFullName || null;

  if (existingProfile) {
    const { error } = await supabase
      .from("profiles")
      .update({
        email,
        full_name: fullNameValue,
      })
      .eq("id", existingProfile.id);

    return {
      success: !error,
      message: error?.message,
    };
  }

  const { error } = await supabase.from("profiles").insert({
    user_id: user.id,
    email,
    full_name: fullNameValue,
  });

  return {
    success: !error,
    message: error?.message,
  };
}

export async function insertInvitationAuditLog(
  supabase: InvitationMutationClient,
  input: {
    organizationId: string;
    userId: string | null;
    action: "invitation_created" | "invitation_accepted" | "invitation_revoked";
    invitationId: string;
  },
) {
  await supabase.from("audit_logs").insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    action: input.action,
    entity_type: "organization_invitation",
    entity_id: input.invitationId,
  });
}

export function invitationCanBeAccepted(invitation: OrganizationInvitationRow) {
  return invitation.status === "pending" && !isExpired(invitation.expires_at);
}
