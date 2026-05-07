export type InternalAccessRole = "falcondraft_admin" | "client";

export type InternalAccessState = {
  role: InternalAccessRole;
  isInternalUser: boolean;
  label: string;
};

export const mockInternalAccess = {
  role: "falcondraft_admin",
  isInternalUser: true,
  label: "Équipe FalconDraft",
} satisfies InternalAccessState;

export function canViewInternalAdmin(access: InternalAccessState): boolean {
  return access.isInternalUser && access.role === "falcondraft_admin";
}
