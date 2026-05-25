import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import {
  canManageWorkspace,
  normalizeWorkspaceRole,
} from "@/lib/auth/workspace-permissions";
import { canAccessProspection, canViewInternalAdmin } from "@/lib/internal-access";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await requireActiveWorkspaceContext();
  const displayName =
    context.profile?.full_name ?? context.user.email ?? "Utilisateur";
  const showInternalAdmin = canViewInternalAdmin(context);

  return (
    <DashboardShell
      organization={
        context.organization
          ? {
              name: context.organization.name,
            }
          : null
      }
      user={{
        name: displayName,
        email: context.user.email ?? "",
        roleKey: normalizeWorkspaceRole(context.membership?.role) ?? "member",
      }}
      showInternalAdmin={showInternalAdmin}
      showProspection={canAccessProspection(context)}
      canManageBilling={canManageWorkspace(context.membership?.role)}
    >
      {children}
    </DashboardShell>
  );
}
