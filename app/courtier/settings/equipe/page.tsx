import { TeamManagementPanel } from "@/components/settings/team-management-panel";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { canManageWorkspace } from "@/lib/auth/workspace-permissions";
import { canManageWorkspaceInvitations } from "@/lib/invitations/shared";
import {
  getPendingInvitationsForOrganization,
  getTeamMembersForOrganization,
} from "@/lib/data/supabase-app-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CourtierTeamSettingsPage() {
  const context = await requireActiveWorkspaceContext();
  const organization = context.organization!;
  const [teamMembers, pendingInvitations] = await Promise.all([
    getTeamMembersForOrganization(organization.id),
    getPendingInvitationsForOrganization(organization.id),
  ]);

  return (
    <TeamManagementPanel
      organizationId={organization.id}
      currentUserId={context.user.id}
      currentUserRole={context.membership?.role ?? null}
      canManageMembers={canManageWorkspace(context.membership?.role)}
      canManageInvitations={canManageWorkspaceInvitations(
        context.membership?.role,
      )}
      members={teamMembers}
      pendingInvitations={pendingInvitations}
    />
  );
}
