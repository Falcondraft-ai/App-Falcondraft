import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireCurrentUserContext } from "@/lib/auth/session";

function roleLabel(role: string | null | undefined) {
  if (role === "owner") {
    return "Propriétaire";
  }

  if (role === "admin") {
    return "Administrateur";
  }

  return "Membre";
}

function canViewInternalAdmin(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await requireCurrentUserContext();
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
        roleLabel: roleLabel(context.membership?.role),
      }}
      showInternalAdmin={canViewInternalAdmin(context.membership?.role)}
    >
      {children}
    </DashboardShell>
  );
}
