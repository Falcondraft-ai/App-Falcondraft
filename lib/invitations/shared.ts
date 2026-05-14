import { canManageWorkspace } from "@/lib/auth/workspace-permissions";

export const invitationRoles = ["manager", "member", "viewer"] as const;

export type InvitationRole = (typeof invitationRoles)[number];

export type InvitationLookupState =
  | "valid"
  | "missing"
  | "invalid"
  | "expired"
  | "revoked"
  | "accepted";

export type PublicInvitationData = {
  organizationName: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
};

export type InvitationLookupResult = {
  valid: boolean;
  state: InvitationLookupState;
  invitation: PublicInvitationData | null;
};

export function isInvitationRole(value: string): value is InvitationRole {
  return invitationRoles.includes(value as InvitationRole);
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function getWorkspaceRoleLabel(role: string) {
  if (role === "manager") {
    return "Gestionnaire";
  }

  if (role === "viewer") {
    return "Lecteur";
  }

  return "Collaborateur";
}

export function canManageWorkspaceInvitations(role: string | null | undefined) {
  return canManageWorkspace(role);
}
