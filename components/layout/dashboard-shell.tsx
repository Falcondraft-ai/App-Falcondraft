"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  ChevronDown,
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
} from "lucide-react";
import * as React from "react";
import { BrandMark } from "@/components/common/brand-mark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  canViewInternalAdmin,
  mockInternalAccess,
} from "@/lib/internal-access";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const primaryNavItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/deals",
    label: "Opportunités",
    icon: BarChart3,
  },
  {
    href: "/dashboard/documents",
    label: "Documents",
    icon: FileText,
  },
  {
    href: "/dashboard/settings",
    label: "Paramètres",
    icon: Settings,
  },
];

const internalNavItems: NavItem[] = [
  {
    href: "/admin",
    label: "Admin interne",
    icon: ShieldCheck,
  },
];

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function OrganizationSwitcher() {
  return (
    <button className="hover:bg-card flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2.5 text-left transition-colors active:translate-y-px">
      <span className="flex min-w-0 items-center gap-2">
        <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
          <Building2 className="size-3.5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            Atelier Archipel
          </span>
          <span className="text-muted-foreground block text-xs">
            Organisation active
          </span>
        </span>
      </span>
      <ChevronDown className="text-muted-foreground size-4" strokeWidth={1.75} />
    </button>
  );
}

function NavList({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-5" aria-label="Navigation principale">
      <div className="space-y-1">
        {primaryNavItems.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
              "group flex items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm transition-colors",
              active
                ? "border-border bg-card text-foreground"
                : "text-muted-foreground hover:bg-card hover:text-foreground",
              )}
            >
              <Icon
                className="size-4"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {canViewInternalAdmin(mockInternalAccess) ? (
        <div className="border-t pt-4">
          <p className="text-muted-foreground px-3 pb-2 text-[11px] font-medium tracking-[0.14em] uppercase">
            Interne
          </p>
          <div className="space-y-1">
            {internalNavItems.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-sm transition-colors",
                    active
                      ? "border-slate-900/15 bg-slate-950 text-white"
                      : "text-muted-foreground hover:bg-card hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      className="size-4"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </span>
                  <span
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 text-[10px]",
                      active
                        ? "border-white/25 text-white/75"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    Staff
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </nav>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="min-h-dvh bg-background">
      <aside className="bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 hidden w-[16.5rem] border-r lg:flex lg:flex-col">
        <div className="border-b px-5 py-4">
          <BrandMark href="/dashboard" size="md" />
        </div>
        <div className="border-b p-4">
          <OrganizationSwitcher />
        </div>
        <div className="flex-1 px-3 py-4">
          <NavList pathname={pathname} />
        </div>
        <div className="border-t px-4 py-3">
          <div className="text-muted-foreground text-xs leading-5">
            Espace commercial · Atelier Archipel
          </div>
        </div>
      </aside>

      <div className="lg:pl-[16.5rem]">
        <header className="sticky top-0 z-40 border-b bg-background">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Ouvrir la navigation"
                  >
                    <Menu className="size-4" strokeWidth={1.75} />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Navigation FalconDraft</SheetTitle>
                    <SheetDescription>
                      Accès aux principales sections de l’espace client.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex h-full flex-col">
                    <div className="flex h-16 items-center border-b px-5">
                      <BrandMark href="/dashboard" size="md" />
                    </div>
                    <div className="border-b p-4">
                      <OrganizationSwitcher />
                    </div>
                    <div className="flex-1 px-3 py-4">
                      <NavList
                        pathname={pathname}
                        onNavigate={() => setMobileOpen(false)}
                      />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <div className="lg:hidden">
                <BrandMark href="/dashboard" size="sm" showDescriptor={false} />
              </div>
              <div className="hidden lg:block">
                <p className="text-muted-foreground text-sm tracking-[-0.01em]">
                  Opportunité → proposition → validation → envoi
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/dashboard/deals/new">Créer une opportunité</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="hover:bg-muted flex items-center gap-2 rounded-lg p-1.5 transition-colors"
                    aria-label="Menu utilisateur"
                  >
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg text-xs">
                        CV
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown
                      className="text-muted-foreground hidden size-4 sm:block"
                      strokeWidth={1.75}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <span className="block text-sm">Clémence Varlet</span>
                    <span className="text-muted-foreground block text-xs font-normal">
                      Direction commerciale
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>Profil</DropdownMenuItem>
                  <DropdownMenuItem disabled>Aide</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>Déconnexion</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
