import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { normalizeWorkspaceRole } from "@/lib/auth/workspace-permissions";
import { canAccessProspection, canViewInternalAdmin } from "@/lib/internal-access";

export default async function ProspectionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await requireActiveWorkspaceContext();

  if (!canAccessProspection(context)) {
    notFound();
  }

  const displayName =
    context.profile?.full_name ?? context.user.email ?? "Utilisateur";

  return (
    <DashboardShell
      organization={
        context.organization
          ? { name: context.organization.name }
          : null
      }
      user={{
        name: displayName,
        email: context.user.email ?? "",
        roleKey: normalizeWorkspaceRole(context.membership?.role) ?? "member",
      }}
      showInternalAdmin={canViewInternalAdmin(context)}
      showProspection={true}
    >
      {children}
    </DashboardShell>
  );
}
