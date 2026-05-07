"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
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
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
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

type DashboardShellUser = {
  name: string;
  email: string;
  roleLabel: string;
};

type DashboardShellOrganization = {
  name: string;
  slug: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase() ?? "")
    .join("");
}

function WorkspaceContext({
  organization,
}: {
  organization: DashboardShellOrganization | null;
}) {
  return (
    <section className="border-y bg-background px-5 py-4">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.16em] uppercase">
        Espace
      </p>
      <div className="mt-2 border-l-2 border-primary pl-3">
        <p className="truncate text-sm font-semibold tracking-tight">
          {organization?.name ?? "Espace client"}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {organization?.slug ?? "Production commerciale"}
        </p>
      </div>
    </section>
  );
}

function NavList({
  pathname,
  onNavigate,
  showInternalAdmin,
}: {
  pathname: string;
  onNavigate?: () => void;
  showInternalAdmin: boolean;
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
                  ? "border-border bg-card text-foreground shadow-[inset_3px_0_0_var(--primary)]"
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

      {showInternalAdmin ? (
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
                      "border px-1.5 py-0.5 text-[10px]",
                      active
                        ? "border-white/25 text-white/75"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    Interne
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

export function DashboardShell({
  children,
  organization,
  user,
  showInternalAdmin,
}: {
  children: React.ReactNode;
  organization: DashboardShellOrganization | null;
  user: DashboardShellUser;
  showInternalAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  function openHelp() {
    toast("Aide FalconDraft", {
      description: "Le centre d’aide sera disponible depuis cet espace.",
    });
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();

    if (supabase) {
      await supabase.auth.signOut();
    }

    toast.success("Session fermée");
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-background">
      <aside className="bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 hidden w-[17.5rem] border-r lg:flex lg:flex-col">
        <div className="px-5 py-5">
          <BrandMark href="/dashboard" size="lg" />
        </div>
        <WorkspaceContext organization={organization} />
        <div className="flex-1 px-3 py-4">
          <NavList pathname={pathname} showInternalAdmin={showInternalAdmin} />
        </div>
        <div className="border-t px-4 py-3">
          <div className="text-muted-foreground text-xs leading-5">
            FalconDraft · Propositions commerciales
          </div>
        </div>
      </aside>

      <div className="lg:pl-[17.5rem]">
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
                    <div className="px-5 py-5">
                      <BrandMark href="/dashboard" size="lg" />
                    </div>
                    <WorkspaceContext organization={organization} />
                    <div className="flex-1 px-3 py-4">
                      <NavList
                        pathname={pathname}
                        onNavigate={() => setMobileOpen(false)}
                        showInternalAdmin={showInternalAdmin}
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
                    className="hover:bg-muted flex items-center gap-2 rounded-md p-1.5 transition-colors"
                    aria-label="Menu utilisateur"
                  >
                    <Avatar className="size-8 rounded-md">
                      <AvatarFallback className="rounded-md text-xs">
                        {getInitials(user.name) || "FD"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <span className="block text-sm">{user.name}</span>
                    <span className="text-muted-foreground block text-xs font-normal">
                      {user.roleLabel}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">Profil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={openHelp}>Aide</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={signOut}>
                    Déconnexion
                  </DropdownMenuItem>
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
