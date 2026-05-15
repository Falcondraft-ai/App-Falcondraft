import { InternalAdminConsole } from "@/components/admin/internal-admin-console";
import { PageTransition } from "@/components/common/page-transition";
import { T } from "@/components/i18n/translated-text";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getInternalAdminWorkspaceData } from "@/lib/internal-admin/data";
import { canViewInternalAdmin } from "@/lib/internal-access";

export default async function AdminPage() {
  const context = await requireCurrentUserContext();
  const hasInternalAccess = canViewInternalAdmin(context);

  if (!hasInternalAccess) {
    return (
      <PageTransition>
        <section className="bg-card rounded-lg border p-6">
          <p className="text-muted-foreground text-sm">
            <T tx="admin.restricted" />
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            <T tx="admin.restrictedTitle" />
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
            <T tx="admin.restrictedDescription" />
          </p>
        </section>
      </PageTransition>
    );
  }

  const adminData = await getInternalAdminWorkspaceData({
    internalOrganizationId: context.organization?.id ?? null,
  });

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="border border-slate-900/15 bg-slate-950 p-5 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-white/72">
              <T tx="admin.console" />
            </p>
            <span className="border border-white/15 px-2 py-1 text-xs text-white/72">
              <T tx="admin.access" />
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Onboarding client
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/72">
            Créez les workspaces client, invitez le premier gestionnaire et
            maintenez les webhooks n8n par organisation depuis la console
            interne FalconDraft.
          </p>
        </div>

        <InternalAdminConsole
          initialOrganizations={adminData.organizations}
          metrics={adminData.metrics}
        />
      </div>
    </PageTransition>
  );
}
