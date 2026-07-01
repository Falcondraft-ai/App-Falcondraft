"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  HardDrive,
  Mail,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const baseTabs = [
  { href: "/courtier/settings", label: "Général", icon: SlidersHorizontal },
  { href: "/courtier/settings/equipe", label: "Équipe & accès", icon: Users },
  { href: "/courtier/settings/stockage", label: "Stockage", icon: HardDrive },
  { href: "/courtier/settings/integrations", label: "Intégrations", icon: Mail },
];

// Billing lives in Stripe and only applies to the self-serve SaaS offerings.
// "Courtier sur mesure" is invoiced manually off-platform, so the tab is hidden.
const billingTab = {
  href: "/courtier/settings/facturation",
  label: "Facturation",
  icon: CreditCard,
};

export function CourtierSettingsNav({
  showBilling = true,
}: {
  showBilling?: boolean;
}) {
  const pathname = usePathname();
  const tabs = showBilling ? [...baseTabs, billingTab] : baseTabs;

  return (
    <nav
      aria-label="Paramètres"
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:w-56 lg:shrink-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0"
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
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-[13px] transition-colors",
              active
                ? "font-medium"
                : "font-normal text-[var(--fg-3)] hover:bg-[var(--brand-navy-50)] hover:text-[var(--fg-1)]",
            )}
            style={
              active
                ? { background: "var(--brand-navy-50)", color: "var(--fg-1)" }
                : undefined
            }
          >
            <Icon
              className="size-4 shrink-0"
              strokeWidth={1.75}
              aria-hidden="true"
              style={{ color: active ? "var(--brand-navy-700)" : "var(--fg-3)" }}
            />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
