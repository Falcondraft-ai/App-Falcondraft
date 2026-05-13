import { PageTransition } from "@/components/common/page-transition";
import { TeamManagementPanel } from "@/components/settings/team-management-panel";
import { requireCurrentUserContext } from "@/lib/auth/session";
import {
  getPendingInvitationsForOrganization,
  getTeamMembersForOrganization,
} from "@/lib/data/supabase-app-data";
import { canManageWorkspaceInvitations } from "@/lib/invitations/shared";

export default async function TeamSettingsPage() {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id ?? null;
  const [teamMembers, pendingInvitations] = await Promise.all([
    getTeamMembersForOrganization(organizationId),
    getPendingInvitationsForOrganization(organizationId),
  ]);

  return (
    <PageTransition>
      <TeamManagementPanel
        organizationId={organizationId}
        canManageInvitations={canManageWorkspaceInvitations(
          context.membership?.role,
        )}
        members={teamMembers}
        pendingInvitations={pendingInvitations}
      />
    </PageTransition>
  );
}
