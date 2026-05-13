import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireCurrentUserContext } from "@/lib/auth/session";

function roleLabel(role: string | null | undefined) {
  if (role === "owner") {
    return "Propriétaire";
  }

  if (role === "admin") {
    return "Gestionnaire";
  }

  return "Collaborateur";
}

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await requireCurrentUserContext();
  const displayName =
    context.profile?.full_name ?? context.user.email ?? "Utilisateur";
  const showInternalAdmin =
    context.membership?.role === "owner" || context.membership?.role === "admin";

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
