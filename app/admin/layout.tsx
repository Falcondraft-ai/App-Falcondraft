import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canViewInternalAdmin } from "@/lib/internal-access";
import { getWorkspaceRoleLabel } from "@/lib/invitations/shared";

function roleLabel(role: string | null | undefined) {
  return role ? getWorkspaceRoleLabel(role) : "Collaborateur";
}

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await requireCurrentUserContext();
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
        roleLabel: roleLabel(context.membership?.role),
      }}
      showInternalAdmin={showInternalAdmin}
    >
      {children}
    </DashboardShell>
  );
}
