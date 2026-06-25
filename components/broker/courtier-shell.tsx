"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  FolderOpen,
  HardDrive,
  LayoutDashboard,
  Mail,
  Menu,
  Plus,
  ScrollText,
  Settings,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  fetchProfilePhotoUrl,
  LEGACY_PROFILE_PHOTO_STORAGE_KEY,
  PROFILE_PHOTO_UPDATED_EVENT,
} from "@/lib/profile-photo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { AgentChat } from "@/components/broker/agent-chat";
import { CourtierNotifications } from "@/components/broker/courtier-notifications";
import { CourtierTopbarSearch } from "@/components/broker/courtier-topbar-search";
import { formatBytes, type StorageUsage } from "@/lib/broker/storage";

const SIDEBAR_WIDTH = 256;
const SUBMENU_WIDTH = 210;
const SUBMENU_CLOSE_DELAY = 120;

const roleLabels: Record<string, string> = {
  manager: "Gestionnaire",
  member: "Collaborateur",
  viewer: "Lecteur",
};

type NavSubItem = { href: string; label: string; highlight?: boolean };

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  comingSoon?: boolean;
  submenu?: NavSubItem[];
};

const navItems: NavItem[] = [
  { href: "/courtier", label: "Tableau de bord", icon: LayoutDashboard },
  {
    href: "/courtier/clients",
    label: "Dossiers clients",
    icon: Users,
    submenu: [
      { href: "/courtier/clients", label: "Tous les dossiers" },
      { href: "/courtier/clients/new", label: "+ Nouveau dossier", highlight: true },
    ],
  },
  {
    href: "/courtier/contracts",
    label: "Contrats",
    icon: ScrollText,
    submenu: [
      { href: "/courtier/contracts", label: "Tous les contrats" },
      {
        href: "/courtier/contracts/renouvellements",
        label: "Renouvellements",
      },
    ],
  },
  { href: "/courtier/commissions", label: "Commissions", icon: Wallet },
  { href: "/courtier/sinistres", label: "Sinistres", icon: ShieldAlert },
  { href: "/courtier/documents", label: "Documents", icon: FolderOpen },
  {
    href: "/courtier/inbox",
    label: "Assistant Outlook",
    icon: Mail,
  },
];

const settingsItem: NavItem = {
  href: "/courtier/settings",
  label: "Paramètres",
  icon: Settings,
};

export type CourtierShellUser = {
  name: string;
  email: string;
  roleKey: string;
};

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.at(0)?.toUpperCase() ?? "")
      .join("") || "FD"
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/courtier") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandHeader() {
  return (
    <div
      className="flex items-center border-b px-4 py-4"
      style={{
        backgroundColor: "var(--sidebar-bg)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      <Link
        href="/courtier"
        className="flex min-w-0 items-center gap-3"
        aria-label="FalconDraft"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center">
          <img
            src="/bimi/logo.svg"
            alt=""
            aria-hidden="true"
            className="h-11 w-11 scale-[1.15] object-contain"
          />
        </div>
        <span className="min-w-0 leading-tight">
          <span
            className="block text-[17px] font-semibold tracking-[-0.025em]"
            style={{ color: "var(--sidebar-text-active)" }}
          >
            FalconDraft
          </span>
          <span
            className="mt-[2px] block text-[11px] font-medium"
            style={{ color: "var(--sidebar-text)", letterSpacing: "0.01em" }}
          >
            Espace courtier
          </span>
        </span>
      </Link>
    </div>
  );
}

function WorkspaceContext({ organizationName }: { organizationName: string }) {
  return (
    <section
      className="border-b px-4 py-3.5"
      style={{
        backgroundColor: "var(--sidebar-hover)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      <div
        className="border-l-2 pl-3"
        style={{ borderColor: "rgba(148,163,184,0.35)" }}
      >
        <p
          className="text-[9.5px] font-semibold uppercase"
          style={{ color: "var(--sidebar-text)", letterSpacing: "0.14em" }}
        >
          Cabinet de courtage
        </p>
        <p
          className="mt-1 truncate text-[13px] font-medium"
          style={{ color: "var(--sidebar-text-active)" }}
        >
          {organizationName}
        </p>
      </div>
    </section>
  );
}

function NavRow({
  item,
  active,
  onNavigate,
  onMouseEnter,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  onMouseEnter?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  const { icon: Icon } = item;
  const hasSubmenu = Boolean(item.submenu && item.submenu.length > 0);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      onMouseEnter={onMouseEnter}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-[7px] border-l-2 h-9 pl-[13px] pr-2.5 text-[13px]",
        "transition-[background-color,color,border-color] duration-150 ease-out",
        !active &&
          "hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-active)]",
      )}
      style={
        active
          ? {
              color: "var(--sidebar-text-active)",
              backgroundColor: "var(--sidebar-active)",
              borderLeftColor: "var(--accent)",
              fontWeight: 500,
            }
          : { color: "var(--sidebar-text)", borderLeftColor: "transparent" }
      }
    >
      <Icon className="size-[17px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.comingSoon ? (
        <span
          className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: "rgba(184,146,42,0.12)",
            color: "var(--accent)",
            borderRadius: "4px",
          }}
        >
          Bientôt
        </span>
      ) : hasSubmenu ? (
        <ChevronRight
          className="size-[14px] shrink-0 opacity-50"
          strokeWidth={2}
          aria-hidden="true"
        />
      ) : null}
    </Link>
  );
}

function SubmenuPanel({
  items,
  pathname,
  top,
  onNavigate,
  onMouseEnter,
  onMouseLeave,
}: {
  items: NavSubItem[];
  pathname: string;
  top: number;
  onNavigate?: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <motion.div
      key="courtier-submenu"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-40 p-1.5"
      style={{
        left: SIDEBAR_WIDTH,
        top,
        width: SUBMENU_WIDTH,
        backgroundColor: "#FFFFFF",
        border: "1px solid var(--border-1)",
        borderRadius: 8,
        boxShadow: "var(--shadow-lg)",
      }}
      role="menu"
    >
      {items.map((item) => {
        const active =
          pathname === item.href.split("?")[0] && !item.highlight;
        return (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            onClick={onNavigate}
            className={cn(
              "block rounded-[6px] px-3 py-2 text-[13px] transition-colors duration-150",
              active && "font-medium",
            )}
            style={
              active
                ? {
                    backgroundColor: "var(--accent-soft)",
                    color: "var(--accent-foreground)",
                  }
                : {
                    color: item.highlight ? "var(--accent)" : "var(--fg-1)",
                    fontWeight: item.highlight ? 500 : 400,
                  }
            }
            onMouseEnter={(e) => {
              if (active) return;
              e.currentTarget.style.backgroundColor = "var(--brand-navy-50)";
            }}
            onMouseLeave={(e) => {
              if (active) return;
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </motion.div>
  );
}

function StorageGauge({ usage }: { usage: StorageUsage }) {
  const barColor =
    usage.level === "full" || usage.level === "critical"
      ? "var(--destructive)"
      : usage.level === "warning"
        ? "var(--warning)"
        : "var(--accent)";

  return (
    <Link
      href="/courtier/settings"
      className="block rounded-[7px] px-3 py-2.5 transition-colors hover:bg-[var(--sidebar-hover)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="flex items-center gap-1.5 text-[11px] font-medium"
          style={{ color: "var(--sidebar-text)" }}
        >
          <HardDrive className="size-3.5" strokeWidth={1.75} />
          Stockage
        </span>
        <span
          className="text-[11px] font-semibold"
          style={{ color: "var(--sidebar-text-active)" }}
        >
          {usage.percent}%
        </span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "rgba(148,163,184,0.18)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${Math.max(2, usage.percent)}%`, background: barColor }}
        />
      </div>
      <p className="mt-1.5 text-[10.5px]" style={{ color: "var(--sidebar-text)" }}>
        {formatBytes(usage.usedBytes)} / {formatBytes(usage.limitBytes)}
      </p>
    </Link>
  );
}

function SidebarBody({
  pathname,
  organizationName,
  usage,
  onNavigate,
  onSubmenuOpen,
  onSubmenuClose,
}: {
  pathname: string;
  organizationName: string;
  usage: StorageUsage;
  onNavigate?: () => void;
  onSubmenuOpen?: (top: number, items: NavSubItem[]) => void;
  onSubmenuClose?: () => void;
}) {
  return (
    <>
      <BrandHeader />
      <WorkspaceContext organizationName={organizationName} />
      <div className="flex-1 overflow-y-auto px-2.5 pt-4 pb-3">
        <nav className="space-y-0.5" aria-label="Navigation courtier">
          {navItems.map((item) => (
            <NavRow
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              onNavigate={onNavigate}
              onMouseEnter={
                onSubmenuOpen
                  ? (event) => {
                      if (item.submenu && item.submenu.length > 0) {
                        const rect =
                          event.currentTarget.getBoundingClientRect();
                        onSubmenuOpen(rect.top, item.submenu);
                      } else {
                        onSubmenuClose?.();
                      }
                    }
                  : undefined
              }
            />
          ))}
        </nav>
      </div>
      <div
        className="border-t px-2.5 pt-2.5 pb-3"
        style={{ borderColor: "var(--sidebar-border)" }}
        onMouseEnter={() => onSubmenuClose?.()}
      >
        <StorageGauge usage={usage} />
        <div className="mt-1.5">
          <NavRow
            item={settingsItem}
            active={isActive(pathname, settingsItem.href)}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </>
  );
}

export function CourtierShell({
  children,
  organizationName,
  user,
  usage,
}: {
  children: React.ReactNode;
  organizationName: string;
  user: CourtierShellUser;
  usage: StorageUsage;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = React.useState<string | null>(
    null,
  );
  const [activeSubmenu, setActiveSubmenu] = React.useState<{
    items: NavSubItem[];
    top: number;
  } | null>(null);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);
  const scheduleClose = React.useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(
      () => setActiveSubmenu(null),
      SUBMENU_CLOSE_DELAY,
    );
  }, [cancelClose]);
  const openSubmenu = React.useCallback(
    (anchorTop: number, items: NavSubItem[]) => {
      cancelClose();
      const viewportH =
        typeof window !== "undefined" ? window.innerHeight : 1000;
      const top = Math.max(
        12,
        Math.min(anchorTop, viewportH - (items.length * 38 + 16)),
      );
      setActiveSubmenu({ items, top });
    },
    [cancelClose],
  );

  React.useEffect(() => {
    setActiveSubmenu(null);
  }, [pathname]);
  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    function readProfilePhoto() {
      window.localStorage.removeItem(LEGACY_PROFILE_PHOTO_STORAGE_KEY);
      void fetchProfilePhotoUrl().then((url) => setProfilePhotoUrl(url));
    }
    readProfilePhoto();
    window.addEventListener(PROFILE_PHOTO_UPDATED_EVENT, readProfilePhoto);
    return () =>
      window.removeEventListener(PROFILE_PHOTO_UPDATED_EVENT, readProfilePhoto);
  }, []);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    toast.success("Vous êtes déconnecté.");
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <aside
        onMouseLeave={scheduleClose}
        className="fixed inset-y-0 left-0 z-30 hidden border-r lg:flex lg:flex-col"
        style={{
          width: SIDEBAR_WIDTH,
          backgroundColor: "var(--sidebar-bg)",
          borderColor: "var(--sidebar-border)",
          color: "var(--sidebar-text)",
        }}
      >
        <SidebarBody
          pathname={pathname}
          organizationName={organizationName}
          usage={usage}
          onSubmenuOpen={openSubmenu}
          onSubmenuClose={scheduleClose}
        />

        <AnimatePresence>
          {activeSubmenu ? (
            <SubmenuPanel
              items={activeSubmenu.items}
              pathname={pathname}
              top={activeSubmenu.top}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              onNavigate={() => setActiveSubmenu(null)}
            />
          ) : null}
        </AnimatePresence>
      </aside>

      <div className="min-h-dvh lg:pl-[256px]">
        <header
          className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b px-4 sm:px-6"
          style={{
            backgroundColor: "#FFFFFF",
            borderBottomColor: "var(--border-1)",
            color: "var(--fg-1)",
            boxShadow: "0 1px 0 rgba(11,18,32,.02)",
          }}
        >
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors lg:hidden"
                style={{
                  background: "var(--brand-navy-50)",
                  border: "1px solid var(--border-1)",
                  color: "var(--fg-2)",
                }}
                aria-label="Ouvrir le menu"
              >
                <Menu className="size-4" strokeWidth={1.75} />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-80 p-0"
              style={{
                backgroundColor: "var(--sidebar-bg)",
                borderColor: "var(--sidebar-border)",
                color: "var(--sidebar-text)",
              }}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>Menu de l’espace courtier</SheetDescription>
              </SheetHeader>
              <div className="flex h-full flex-col">
                <SidebarBody
                  pathname={pathname}
                  organizationName={organizationName}
                  usage={usage}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="hidden min-w-0 shrink-0 md:block md:w-[200px]">
            <p
              className="truncate text-[13px] font-semibold"
              style={{ color: "var(--fg-1)" }}
            >
              {organizationName}
            </p>
            <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>
              Espace courtier
            </p>
          </div>

          <div
            className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 md:block md:w-[460px] lg:w-[520px]"
            style={{ top: "50%", transform: "translate(-50%, -50%)" }}
          >
            <div className="pointer-events-auto">
              <CourtierTopbarSearch placeholder="Rechercher un client…" />
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <CourtierNotifications label="Notifications" />
            <Link
              href="/courtier/clients/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold transition-colors"
              style={{
                background: "var(--brand-navy-800)",
                color: "#FFFFFF",
                border: "1px solid var(--brand-navy-800)",
              }}
            >
              <Plus
                className="size-3.5"
                strokeWidth={2.25}
                style={{ color: "var(--accent)" }}
              />
              <span className="hidden sm:inline">Nouveau dossier</span>
            </Link>

            <span
              aria-hidden
              className="hidden h-6 w-px sm:block"
              style={{ background: "var(--border-1)" }}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full transition-colors"
                  aria-label="Menu utilisateur"
                >
                  <Avatar className="size-8 rounded-full shadow-sm ring-2 ring-[var(--border-1)]">
                    {profilePhotoUrl ? (
                      <AvatarImage
                        src={profilePhotoUrl}
                        alt=""
                        className="rounded-full"
                      />
                    ) : null}
                    <AvatarFallback
                      className="rounded-full text-xs font-semibold"
                      style={{
                        background: "var(--brand-amber-500)",
                        color: "var(--brand-navy-900)",
                      }}
                    >
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <span className="block text-sm">{user.name}</span>
                  <span className="text-muted-foreground block text-xs font-normal">
                    {roleLabels[user.roleKey] ?? "Collaborateur"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/courtier/settings">Paramètres</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut}>
                  Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[92rem] px-3 py-4 sm:px-6 sm:py-5 lg:px-7">
          {children}
        </main>
      </div>

      <AgentChat />
    </div>
  );
}
