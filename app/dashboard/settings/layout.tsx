import { SettingsNav } from "@/components/layout/settings-nav";

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
          Paramètres
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
          Organisation et accès
        </h1>
      </div>
      <SettingsNav />
      {children}
    </div>
  );
}
