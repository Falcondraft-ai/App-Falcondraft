"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const settingsItems = [
  { href: "/dashboard/settings", label: "Général" },
  { href: "/dashboard/settings/team", label: "Équipe" },
  { href: "/dashboard/settings/integrations", label: "Intégrations" },
  { href: "/dashboard/settings/billing", label: "Facturation" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard/settings") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation des paramètres"
      className="flex gap-1 overflow-x-auto border-b bg-background"
    >
      {settingsItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors",
            isActive(pathname, item.href)
              ? "border-primary bg-card text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
