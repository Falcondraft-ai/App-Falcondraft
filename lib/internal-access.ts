import "server-only";

import type { CurrentUserContext } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/invitations/shared";

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

  return rawValue
    .split(",")
    .map((slug) => normalizeWorkspaceIdentifier(slug))
    .filter(Boolean);
}

function getInternalAdminEmails() {
  const rawValue = process.env.FALCONDRAFT_INTERNAL_ADMIN_EMAILS?.trim();

  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((email) => normalizeEmail(email))
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

  const allowedEmails = getInternalAdminEmails();

  if (allowedEmails.length === 0) {
    return true;
  }

  const userEmail = normalizeEmail(context.user.email ?? "");

  return allowedEmails.includes(userEmail);
}
