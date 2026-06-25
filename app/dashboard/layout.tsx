import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import {
  canManageWorkspace,
  normalizeWorkspaceRole,
} from "@/lib/auth/workspace-permissions";
import { isBrokerWorkspace } from "@/lib/broker/access";
import { canAccessProspection, canViewInternalAdmin } from "@/lib/internal-access";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await requireActiveWorkspaceContext();

  // Insurance-broker workspaces run a separate module with its own shell.
  if (isBrokerWorkspace(context.organization)) {
    redirect("/courtier");
  }

  const displayName =
    context.profile?.full_name ?? context.user.email ?? "Utilisateur";

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
      showInternalAdmin={canViewInternalAdmin(context)}
      showProspection={canAccessProspection(context)}
      canManageBilling={canManageWorkspace(context.membership?.role)}
    >
      {children}
    </DashboardShell>
  );
}
