import "server-only";

import { isWorkspaceManager } from "@/lib/auth/workspace-permissions";
import type { CurrentUserContext } from "@/lib/auth/session";

function getConfiguredFalconDraftWorkspaceId() {
  return process.env.FALCONDRAFT_INTERNAL_WORKSPACE_ID?.trim() || null;
}

function normalizeWorkspaceIdentifier(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, "");
}

function getConfiguredFalconDraftWorkspaceSlugs() {
  const rawValue =
    process.env.FALCONDRAFT_INTERNAL_WORKSPACE_SLUG?.trim() || "falcondraft";

  if (!process.env.FALCONDRAFT_INTERNAL_WORKSPACE_SLUG?.trim()) {
    console.warn(
      "[internal-access] FALCONDRAFT_INTERNAL_WORKSPACE_SLUG not set — using default 'falcondraft'.",
    );
  }

  return rawValue
    .split(",")
    .map((slug) => normalizeWorkspaceIdentifier(slug))
    .filter(Boolean);
}

export function isFalconDraftWorkspace(context: CurrentUserContext) {
  const organization = context.organization;

  if (!organization) {
    return false;
  }

  const configuredId = getConfiguredFalconDraftWorkspaceId();

  if (configuredId && organization.id === configuredId) {
    return true;
  }

  const configuredSlugs = getConfiguredFalconDraftWorkspaceSlugs();
  const organizationSlug = normalizeWorkspaceIdentifier(organization.slug);
  const organizationName = normalizeWorkspaceIdentifier(organization.name);

  return (
    configuredSlugs.includes(organizationSlug) ||
    configuredSlugs.includes(organizationName)
  );
}

export function canViewInternalAdmin(context: CurrentUserContext) {
  if (!isFalconDraftWorkspace(context)) {
    return false;
  }

  if (!context.membership) {
    return false;
  }

  return isWorkspaceManager(context.membership.role);
}
