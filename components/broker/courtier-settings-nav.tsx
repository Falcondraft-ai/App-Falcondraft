"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileBadge,
  HardDrive,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/courtier/settings", label: "Général", icon: SlidersHorizontal },
  { href: "/courtier/settings/contrats", label: "Types de contrat", icon: FileBadge },
  { href: "/courtier/settings/conformite", label: "Conformité", icon: ShieldCheck },
  { href: "/courtier/settings/equipe", label: "Équipe & accès", icon: Users },
  { href: "/courtier/settings/stockage", label: "Stockage", icon: HardDrive },
  { href: "/courtier/settings/integrations", label: "Intégrations", icon: Mail },
];

export function CourtierSettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b pb-px"
      style={{ borderColor: "var(--border-1)" }}
      aria-label="Paramètres"
    >
      {tabs.map((tab) => {
        const active =
          tab.href === "/courtier/settings"
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
            )}
            style={
              active
                ? {
                    borderBottomColor: "var(--brand-navy-800)",
                    color: "var(--fg-1)",
                  }
                : {
                    borderBottomColor: "transparent",
                    color: "var(--fg-3)",
                  }
            }
          >
            <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
