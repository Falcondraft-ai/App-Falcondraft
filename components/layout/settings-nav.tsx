"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/translations";

const settingsItems = [
  { href: "/dashboard/settings", label: "settings.nav.general" },
  { href: "/dashboard/settings/team", label: "settings.nav.team" },
  {
    href: "/dashboard/settings/integrations",
    label: "settings.nav.integrations",
  },
  { href: "/dashboard/settings/billing", label: "settings.nav.billing" },
] as const satisfies ReadonlyArray<{ href: string; label: TranslationKey }>;

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard/settings") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsNav({ showBilling }: { showBilling: boolean }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const visibleItems = settingsItems.filter(
    (item) => showBilling || item.href !== "/dashboard/settings/billing",
  );

  return (
    <nav
      aria-label={t("settings.title")}
      className="bg-background flex gap-1 overflow-x-auto border-b"
    >
      {visibleItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors",
            isActive(pathname, item.href)
              ? "border-primary bg-card text-foreground"
              : "text-muted-foreground hover:text-foreground border-transparent",
          )}
        >
          {t(item.label)}
        </Link>
      ))}
    </nav>
  );
}
