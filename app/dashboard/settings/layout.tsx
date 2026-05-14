import { SettingsNav } from "@/components/layout/settings-nav";
import { T } from "@/components/i18n/translated-text";

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
      <SettingsNav />
      {children}
    </div>
  );
}
