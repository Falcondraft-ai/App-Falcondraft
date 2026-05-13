export const workspaceMemberRoles = ["manager", "member", "viewer"] as const;

export type WorkspaceMemberRole = (typeof workspaceMemberRoles)[number];
export type WorkspaceDataScope = "mine" | "organization";

export type WorkspaceDataAccess = {
  userId: string;
  role: string | null | undefined;
  allowMemberCompanyVisibility: boolean;
  scope?: WorkspaceDataScope;
};

export function normalizeWorkspaceRole(
  role: string | null | undefined,
): WorkspaceMemberRole | null {
  if (role === "manager" || role === "owner" || role === "admin") {
    return "manager";
  }

  if (role === "member") {
    return "member";
  }

  if (role === "viewer") {
    return "viewer";
  }

  return null;
}

export function isWorkspaceManager(role: string | null | undefined) {
  return normalizeWorkspaceRole(role) === "manager";
}

export function canManageWorkspace(role: string | null | undefined) {
  const normalizedRole = normalizeWorkspaceRole(role);

  return normalizedRole === "manager";
}

export function canManageWorkspaceSettings(role: string | null | undefined) {
  return canManageWorkspace(role);
}

export function canCreateWorkspaceRecords(role: string | null | undefined) {
  const normalizedRole = normalizeWorkspaceRole(role);

  return normalizedRole === "manager" || normalizedRole === "member";
}

export function canUseOrganizationDataScope(
  role: string | null | undefined,
  allowMemberCompanyVisibility: boolean,
) {
  const normalizedRole = normalizeWorkspaceRole(role);

  if (normalizedRole === "manager") {
    return true;
  }

  if (normalizedRole === "member" || normalizedRole === "viewer") {
    return allowMemberCompanyVisibility;
  }

  return false;
}

export function shouldUseOwnWorkspaceDataOnly(access?: WorkspaceDataAccess) {
  if (!access) {
    return false;
  }

  if (access.scope === "mine") {
    return true;
  }

  return !canUseOrganizationDataScope(
    access.role,
    access.allowMemberCompanyVisibility,
  );
}

export function canAccessWorkspaceDeal(
  access: WorkspaceDataAccess,
  dealCreatedBy: string | null,
) {
  if (
    canUseOrganizationDataScope(
      access.role,
      access.allowMemberCompanyVisibility,
    )
  ) {
    return true;
  }

  return Boolean(dealCreatedBy && dealCreatedBy === access.userId);
}

export function canMutateWorkspaceDeal(
  access: WorkspaceDataAccess,
  dealCreatedBy: string | null,
) {
  if (!canCreateWorkspaceRecords(access.role)) {
    return false;
  }

  return canAccessWorkspaceDeal(access, dealCreatedBy);
}
