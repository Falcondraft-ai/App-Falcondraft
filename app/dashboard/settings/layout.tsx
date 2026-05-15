import { SettingsNav } from "@/components/layout/settings-nav";
import { T } from "@/components/i18n/translated-text";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canManageWorkspace } from "@/lib/auth/workspace-permissions";

export default async function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await requireCurrentUserContext();
  const showBilling = canManageWorkspace(context.membership?.role);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
          <T tx="settings.eyebrow" />
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
          <T tx="settings.title" />
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          <T tx="settings.description" />
        </p>
      </div>
      <SettingsNav showBilling={showBilling} />
      {children}
    </div>
  );
}
