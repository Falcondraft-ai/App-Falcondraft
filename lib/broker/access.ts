import type { CurrentUserContext } from "@/lib/auth/session";
import type { OrganizationRow, WorkspaceType } from "@/types/database";

export const SALES_AUTOMATION_WORKSPACE: WorkspaceType = "sales_automation";
export const INSURANCE_BROKER_WORKSPACE: WorkspaceType = "insurance_broker";

/**
 * Reads the workspace module of an organization, defaulting to the historical
 * commercial-proposal experience when the column is absent (older rows).
 */
export function getWorkspaceType(
  organization: Pick<OrganizationRow, "workspace_type"> | null | undefined,
): WorkspaceType {
  return organization?.workspace_type === INSURANCE_BROKER_WORKSPACE
    ? INSURANCE_BROKER_WORKSPACE
    : SALES_AUTOMATION_WORKSPACE;
}

export function isBrokerWorkspace(
  organization: Pick<OrganizationRow, "workspace_type"> | null | undefined,
): boolean {
  return getWorkspaceType(organization) === INSURANCE_BROKER_WORKSPACE;
}

/** Any active member of an insurance-broker workspace can use the courtier module. */
export function canAccessBroker(context: CurrentUserContext): boolean {
  if (!context.membership || !context.organization) {
    return false;
  }

  return isBrokerWorkspace(context.organization);
}
