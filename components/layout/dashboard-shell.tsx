"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  Bell,
  ChevronRight,
  Euro,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Mic,
  Plus,
  Settings,
  ShieldCheck,
  Target,
  Workflow,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n/language-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  NotificationsPanel,
  useNotificationsBackgroundSync,
} from "@/components/layout/notifications-panel";
import { TopbarSearch } from "@/components/layout/topbar-search";
import {
  fetchProfilePhotoUrl,
  LEGACY_PROFILE_PHOTO_STORAGE_KEY,
  PROFILE_PHOTO_UPDATED_EVENT,
} from "@/lib/profile-photo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { WorkspaceMemberRole } from "@/lib/auth/workspace-permissions";
import type { TranslationKey } from "@/lib/i18n/translations";

const SIDEBAR_WIDTH = 256;
const SUBMENU_WIDTH = 208;
const SUBMENU_CLOSE_DELAY = 120;

type NavSubItem = {
  label: string;
  href: string;
  highlight?: boolean;
  adminOnly?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  submenu?: NavSubItem[];
  comingSoon?: boolean;
};

type InternalNavItem = {
  href: string;
  label: TranslationKey;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const internalNavItems: InternalNavItem[] = [
  { href: "/admin", label: "nav.internalAdmin", icon: ShieldCheck },
];

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isSubItemActive(
  pathname: string,
  search: string,
  itemHref: string,
): boolean {
  const [path, query] = itemHref.split("?");
  if (pathname !== path) {
    if (query) return false;
    return false;
  }

  if (!query) {
    return !search || search === "?";
  }

  const expected = new URLSearchParams(query);
  const current = new URLSearchParams(search);

  for (const [key, value] of expected.entries()) {
    if (current.get(key) !== value) return false;
  }

  return true;
}

type DashboardShellUser = {
  name: string;
  email: string;
  roleKey: WorkspaceMemberRole;
};

type DashboardShellOrganization = {
  name: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase() ?? "")
    .join("");
}

function buildPrimaryNavItems(
  t: (key: TranslationKey) => string,
): NavItem[] {
  return [
    { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    {
      href: "/dashboard/deals",
      label: t("nav.deals"),
      icon: FolderOpen,
      submenu: [
        { label: t("deals.tabs.mine"), href: "/dashboard/deals?scope=mine" },
        {
          label: t("deals.tabs.organization"),
          href: "/dashboard/deals?scope=organization",
        },
        {
          label: t("common.actions.newDeal"),
          href: "/dashboard/deals/new",
          highlight: true,
        },
      ],
    },
    { href: "/dashboard/documents", label: t("nav.documents"), icon: FileText },
    {
      href: "/dashboard/transcripts",
      label: t("nav.transcripts"),
      icon: Mic,
      submenu: [
        { label: "Mes transcripts", href: "/dashboard/transcripts" },
        { label: "Récupérer un appel", href: "/dashboard/transcripts/recall" },
        {
          label: "+ Nouveau transcript",
          href: "/dashboard/transcripts/new",
          highlight: true,
        },
      ],
    },
    {
      href: "/dashboard/quotes",
      label: t("nav.quotes"),
      icon: Euro,
      comingSoon: true,
    },
    {
      href: "/dashboard/workflows",
      label: t("nav.workflows"),
      icon: Workflow,
      comingSoon: true,
    },
    { href: "/dashboard/archive", label: t("nav.archives"), icon: Archive },
  ];
}

function buildSettingsNavItem(
  t: (key: TranslationKey) => string,
  canManageBilling: boolean,
): NavItem {
  const submenu: NavSubItem[] = [
    { label: t("settings.nav.general"), href: "/dashboard/settings" },
    { label: t("settings.nav.team"), href: "/dashboard/settings/team" },
    {
      label: t("settings.nav.integrations"),
      href: "/dashboard/settings/integrations",
    },
    {
      label: t("settings.nav.billing"),
      href: "/dashboard/settings/billing",
      adminOnly: true,
    },
  ].filter((item) => (item.adminOnly ? canManageBilling : true));

  return {
    href: "/dashboard/settings",
    label: t("nav.settings"),
    icon: Settings,
    submenu,
  };
}

function WorkspaceContext({
  organization,
}: {
  organization: DashboardShellOrganization | null;
}) {
  const { t } = useI18n();

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
        style={{ borderColor: "var(--accent)" }}
      >
        <p
          className="text-[9.5px] font-semibold uppercase"
          style={{
            color: "var(--accent)",
            letterSpacing: "0.16em",
          }}
        >
          Production commerciale
        </p>
        <p
          className="mt-1 truncate text-[13px] font-medium"
          style={{ color: "var(--sidebar-text-active)" }}
        >
          {organization?.name ?? t("shell.workspaceFallback")}
        </p>
      </div>
    </section>
  );
}

function SidebarBrandHeader({
  organizationName,
}: {
  organizationName?: string | null;
}) {
  return (
    <div
      className="flex items-center border-b px-4 py-4"
      style={{
        backgroundColor: "var(--sidebar-bg)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-3 min-w-0"
        aria-label="FalconDraft"
      >
        <div className="h-11 w-11 flex items-center justify-center shrink-0">
          <img
            src="/bimi/logo.svg"
            alt=""
            aria-hidden="true"
            className="h-11 w-11 object-contain scale-[1.15]"
          />
        </div>
        <span className="min-w-0 leading-tight">
          <span
            className="block text-[17px] font-semibold tracking-[-0.025em]"
            style={{ color: "var(--sidebar-text-active)" }}
          >
            FalconDraft
          </span>
          {organizationName ? (
            <span
              className="mt-[2px] block truncate text-[11px] font-medium"
              style={{ color: "var(--sidebar-text)", letterSpacing: "0.01em" }}
            >
              {organizationName}
            </span>
          ) : null}
        </span>
      </Link>
    </div>
  );
}

type NavRowProps = {
  href: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  active: boolean;
  hasSubmenu?: boolean;
  badge?: string;
  onNavigate?: () => void;
  onMouseEnter?: React.MouseEventHandler<HTMLAnchorElement>;
};

const NavRow = React.forwardRef<HTMLAnchorElement, NavRowProps>(
  function NavRow(
    { href, label, Icon, active, hasSubmenu, badge, onNavigate, onMouseEnter },
    ref,
  ) {
    return (
      <Link
        ref={ref}
        href={href}
        onClick={onNavigate}
        onMouseEnter={onMouseEnter}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-[7px] border-l-2",
          "h-9 pl-[13px] pr-2.5 text-[13px]",
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
            : {
                color: "var(--sidebar-text)",
                borderLeftColor: "transparent",
              }
        }
      >
        <Icon
          className="size-[17px] shrink-0"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {badge ? (
          <span
            className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: "rgba(184,146,42,0.12)",
              color: "var(--accent)",
              borderRadius: "4px",
            }}
          >
            {badge}
          </span>
        ) : null}
        {hasSubmenu ? (
          <ChevronRight
            className="size-[14px] shrink-0 opacity-50"
            strokeWidth={2}
            aria-hidden="true"
          />
        ) : null}
      </Link>
    );
  },
);

function SubmenuPanel({
  items,
  pathname,
  search,
  onNavigate,
  onMouseEnter,
  onMouseLeave,
  top,
}: {
  items: NavSubItem[];
  pathname: string;
  search: string;
  onNavigate?: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  top: number;
}) {
  return (
    <motion.div
      key="submenu"
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
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "var(--shadow-lg)",
      }}
      role="menu"
    >
      {items.map((item) => {
        const active = isSubItemActive(pathname, search, item.href);
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
                    color: item.highlight
                      ? "var(--accent)"
                      : "var(--foreground)",
                    fontWeight: item.highlight ? 500 : 400,
                  }
            }
            onMouseEnter={(event) => {
              if (active) return;
              event.currentTarget.style.backgroundColor =
                "var(--background-subtle)";
            }}
            onMouseLeave={(event) => {
              if (active) return;
              event.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </motion.div>
  );
}

function SettingsRow({
  item,
  pathname,
  onSubmenuOpen,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onSubmenuOpen?: (href: string, top: number, items: NavSubItem[]) => void;
  onNavigate?: () => void;
}) {
  const active = isNavItemActive(pathname, item.href);
  const handleEnter: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
    if (!onSubmenuOpen || !item.submenu || item.submenu.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onSubmenuOpen(item.href, rect.top, item.submenu);
  };

  return (
    <NavRow
      href={item.href}
      label={item.label}
      Icon={item.icon}
      active={active}
      hasSubmenu={Boolean(item.submenu && item.submenu.length > 0)}
      onNavigate={onNavigate}
      onMouseEnter={onSubmenuOpen ? handleEnter : undefined}
    />
  );
}

function NavList({
  navItems,
  pathname,
  search,
  showInternalAdmin,
  showProspection,
  onNavigate,
  onSubmenuOpen,
  onSubmenuClose,
  onSubmenuCancelClose,
}: {
  navItems: NavItem[];
  pathname: string;
  search: string;
  showInternalAdmin: boolean;
  showProspection: boolean;
  onNavigate?: () => void;
  onSubmenuOpen?: (href: string, top: number, items: NavSubItem[]) => void;
  onSubmenuClose?: () => void;
  onSubmenuCancelClose?: () => void;
}) {
  const { t } = useI18n();

  const handleEnter =
    (item: NavItem): React.MouseEventHandler<HTMLAnchorElement> =>
    (event) => {
      if (!onSubmenuOpen) return;
      if (item.submenu && item.submenu.length > 0) {
        const rect = event.currentTarget.getBoundingClientRect();
        onSubmenuOpen(item.href, rect.top, item.submenu);
      } else {
        onSubmenuClose?.();
      }
    };

  return (
    <nav className="space-y-6" aria-label={t("nav.primaryLabel")}>
      <div className="space-y-0.5">
        {navItems.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <NavRow
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.icon}
              active={active}
              hasSubmenu={Boolean(item.submenu && item.submenu.length > 0)}
              badge={item.comingSoon ? t("nav.comingSoon") : undefined}
              onNavigate={onNavigate}
              onMouseEnter={onSubmenuOpen ? handleEnter(item) : undefined}
            />
          );
        })}
      </div>

      {showInternalAdmin || showProspection ? (
        <div
          className="mt-2 border-t pt-4"
          style={{ borderColor: "var(--sidebar-border)" }}
        >
          <p
            className="mb-2 px-3 text-[10px] font-semibold uppercase"
            style={{
              color: "var(--sidebar-text)",
              letterSpacing: "0.08em",
            }}
          >
            {t("nav.internal")}
          </p>
          <div
            className="space-y-0.5"
            onMouseEnter={() => onSubmenuClose?.()}
          >
            {showInternalAdmin &&
              internalNavItems.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                return (
                  <NavRow
                    key={item.href}
                    href={item.href}
                    label={t(item.label)}
                    Icon={item.icon}
                    active={active}
                    badge={t("nav.internalBadge")}
                    onNavigate={onNavigate}
                  />
                );
              })}
            {showProspection ? (
              <NavRow
                href="/prospection"
                label={t("nav.prospection")}
                Icon={Target}
                active={isNavItemActive(pathname, "/prospection")}
                badge={t("nav.internalBadge")}
                onNavigate={onNavigate}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </nav>
  );
}

type BreadcrumbSegment = { label: string; href?: string };

function buildBreadcrumb(
  pathname: string,
  workspaceLabel: string,
  t: (key: TranslationKey) => string,
): BreadcrumbSegment[] {
  if (pathname === "/dashboard") {
    return [{ label: workspaceLabel }, { label: t("nav.dashboard") }];
  }
  if (pathname.startsWith("/dashboard/deals")) {
    const segments: BreadcrumbSegment[] = [
      { label: workspaceLabel },
      { label: t("nav.deals"), href: "/dashboard/deals" },
    ];
    if (pathname === "/dashboard/deals/new") {
      segments.push({ label: t("common.actions.newDeal") });
    } else if (pathname !== "/dashboard/deals") {
      segments.push({ label: "Détail" });
    }
    return segments;
  }
  if (pathname.startsWith("/dashboard/transcripts")) {
    const segments: BreadcrumbSegment[] = [
      { label: workspaceLabel },
      { label: t("nav.transcripts"), href: "/dashboard/transcripts" },
    ];
    if (pathname === "/dashboard/transcripts/new") {
      segments.push({ label: "Nouveau" });
    } else if (pathname === "/dashboard/transcripts/recall") {
      segments.push({ label: "Récupérer" });
    } else if (pathname !== "/dashboard/transcripts") {
      segments.push({ label: "Détail" });
    }
    return segments;
  }
  if (pathname.startsWith("/dashboard/documents")) {
    return [{ label: workspaceLabel }, { label: t("nav.documents") }];
  }
  if (pathname.startsWith("/dashboard/quotes")) {
    return [{ label: workspaceLabel }, { label: t("nav.quotes") }];
  }
  if (pathname.startsWith("/dashboard/workflows")) {
    return [{ label: workspaceLabel }, { label: t("nav.workflows") }];
  }
  if (pathname.startsWith("/dashboard/archive")) {
    return [{ label: workspaceLabel }, { label: t("nav.archives") }];
  }
  if (pathname.startsWith("/dashboard/settings")) {
    return [{ label: t("nav.settings") }, { label: t("settings.nav.general") }];
  }
  if (pathname.startsWith("/dashboard/support")) {
    return [{ label: workspaceLabel }, { label: t("shell.help") }];
  }
  if (pathname.startsWith("/admin")) {
    return [{ label: t("nav.internal") }, { label: t("nav.internalAdmin") }];
  }
  if (pathname.startsWith("/prospection")) {
    return [{ label: t("nav.internal") }, { label: t("nav.prospection") }];
  }
  return [{ label: workspaceLabel }];
}

function Breadcrumb({
  pathname,
  workspaceLabel,
  t,
}: {
  pathname: string;
  workspaceLabel: string;
  t: (key: TranslationKey) => string;
}) {
  const segments = React.useMemo(
    () => buildBreadcrumb(pathname, workspaceLabel, t),
    [pathname, workspaceLabel, t],
  );

  return (
    <nav
      className="flex min-w-0 items-center gap-1.5"
      aria-label="Breadcrumb"
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <React.Fragment key={`${segment.label}-${index}`}>
            {index > 0 ? (
              <ChevronRight
                className="size-3 shrink-0"
                style={{ color: "var(--fg-4)" }}
                strokeWidth={2}
                aria-hidden="true"
              />
            ) : null}
            {segment.href && !isLast ? (
              <Link
                href={segment.href}
                className="truncate text-[13px] font-medium transition-colors"
                style={{ color: "var(--fg-3)" }}
                onMouseEnter={(event) =>
                  (event.currentTarget.style.color = "var(--brand-navy-800)")
                }
                onMouseLeave={(event) =>
                  (event.currentTarget.style.color = "var(--fg-3)")
                }
              >
                {segment.label}
              </Link>
            ) : (
              <span
                className="truncate text-[13px]"
                style={{
                  color: isLast ? "var(--fg-1)" : "var(--fg-3)",
                  fontWeight: isLast ? 600 : 500,
                }}
              >
                {segment.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function NotificationsMenu({ label }: { label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors"
          style={{
            background: "var(--brand-navy-50)",
            border: "1px solid var(--border-1)",
            color: "var(--fg-2)",
          }}
          aria-label={label}
          title={label}
          onMouseEnter={(event) =>
            (event.currentTarget.style.background = "var(--brand-navy-100)")
          }
          onMouseLeave={(event) =>
            (event.currentTarget.style.background = "var(--brand-navy-50)")
          }
        >
          <Bell className="size-4" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <NotificationsPanel label={label} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreateMenu({ createLabel }: { createLabel: string }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={createLabel}
          className="inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-md text-[13px] font-semibold transition-colors duration-150 sm:w-auto sm:px-3"
          style={{
            background: "var(--brand-navy-800)",
            color: "#FFFFFF",
            border: "1px solid var(--brand-navy-800)",
            boxShadow: "0 1px 1px rgba(11,18,32,.08)",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = "var(--brand-navy-700)";
            event.currentTarget.style.borderColor = "var(--brand-navy-700)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "var(--brand-navy-800)";
            event.currentTarget.style.borderColor = "var(--brand-navy-800)";
          }}
        >
          <Plus
            className="size-3.5"
            strokeWidth={2.25}
            style={{ color: "var(--accent)" }}
          />
          <span className="hidden sm:inline">{createLabel}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="fd-eyebrow">{createLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => router.push("/dashboard/deals/new")}
          className="flex flex-col items-start gap-0.5 py-2.5"
        >
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            <FolderOpen
              className="size-3.5 text-[var(--brand-navy-700)]"
              strokeWidth={1.75}
            />
            {t("common.actions.newDeal")}
          </span>
          <span className="pl-[22px] text-[11.5px] text-[var(--fg-3)]">
            Dossier commercial complet
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => router.push("/dashboard/transcripts/new")}
          className="flex flex-col items-start gap-0.5 py-2.5"
        >
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            <Mic
              className="size-3.5 text-[var(--brand-navy-700)]"
              strokeWidth={1.75}
            />
            Transcript
          </span>
          <span className="pl-[22px] text-[11.5px] text-[var(--fg-3)]">
            À partir d&apos;un appel ou de notes
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled
          className="flex flex-col items-start gap-0.5 py-2.5 opacity-70"
        >
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            <Euro
              className="size-3.5 text-[var(--fg-4)]"
              strokeWidth={1.75}
            />
            Devis
            <span
              className="ml-1 rounded-[3px] px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-[0.08em]"
              style={{
                background: "var(--brand-amber-50)",
                color: "var(--brand-amber-800)",
                border: "1px solid var(--brand-amber-200)",
              }}
            >
              {t("nav.comingSoon")}
            </span>
          </span>
          <span className="pl-[22px] text-[11.5px] text-[var(--fg-4)]">
            Bientôt disponible
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


export function DashboardShell({
  children,
  organization,
  user,
  showInternalAdmin,
  showProspection,
  canManageBilling,
}: {
  children: React.ReactNode;
  organization: DashboardShellOrganization | null;
  user: DashboardShellUser;
  showInternalAdmin: boolean;
  showProspection: boolean;
  canManageBilling: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  useNotificationsBackgroundSync();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = React.useState<string | null>(
    null,
  );

  const [activeSubmenu, setActiveSubmenu] = React.useState<{
    href: string;
    items: NavSubItem[];
    top: number;
  } | null>(null);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [searchString, setSearchString] = React.useState("");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setSearchString(window.location.search);
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, [pathname]);

  const cancelClose = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = React.useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, SUBMENU_CLOSE_DELAY);
  }, [cancelClose]);

  const openSubmenu = React.useCallback(
    (href: string, anchorTop: number, items: NavSubItem[]) => {
      cancelClose();
      const estimatedHeight = items.length * 36 + 12;
      const viewportH =
        typeof window !== "undefined" ? window.innerHeight : 1000;
      const maxTop = viewportH - estimatedHeight - 12;
      const top = Math.max(12, Math.min(anchorTop, maxTop));
      setActiveSubmenu({ href, top, items });
    },
    [cancelClose],
  );

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    setActiveSubmenu(null);
  }, [pathname]);

  React.useEffect(() => {
    function readProfilePhoto() {
      window.localStorage.removeItem(LEGACY_PROFILE_PHOTO_STORAGE_KEY);
      void fetchProfilePhotoUrl().then((url) => {
        setProfilePhotoUrl(url);
      });
    }

    readProfilePhoto();
    window.addEventListener(PROFILE_PHOTO_UPDATED_EVENT, readProfilePhoto);

    return () => {
      window.removeEventListener(PROFILE_PHOTO_UPDATED_EVENT, readProfilePhoto);
    };
  }, []);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();

    if (supabase) {
      await supabase.auth.signOut();
    }

    toast.success(t("shell.signOutSuccess"));
    router.replace("/login");
    router.refresh();
  }

  const primaryNavItems = React.useMemo(
    () => buildPrimaryNavItems(t),
    [t],
  );
  const settingsNavItem = React.useMemo(
    () => buildSettingsNavItem(t, canManageBilling),
    [t, canManageBilling],
  );

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
        <SidebarBrandHeader organizationName={organization?.name} />
        <WorkspaceContext organization={organization} />
        <div className="flex-1 overflow-y-auto px-2.5 pt-4 pb-3">
          <NavList
            navItems={primaryNavItems}
            pathname={pathname}
            search={searchString}
            showInternalAdmin={showInternalAdmin}
            showProspection={showProspection}
            onSubmenuOpen={openSubmenu}
            onSubmenuClose={scheduleClose}
            onSubmenuCancelClose={cancelClose}
          />
        </div>
        <div
          className="border-t px-2.5 pt-2.5 pb-3"
          style={{ borderColor: "var(--sidebar-border)" }}
        >
          <SettingsRow
            item={settingsNavItem}
            pathname={pathname}
            onSubmenuOpen={openSubmenu}
          />
          <p
            className="mt-3 px-1 text-[10px] font-medium tracking-[0.06em]"
            style={{ color: "var(--sidebar-text)", opacity: 0.45 }}
          >
            {t("shell.footer")}
          </p>
        </div>

        <AnimatePresence>
          {activeSubmenu ? (
            <SubmenuPanel
              items={activeSubmenu.items}
              pathname={pathname}
              search={searchString}
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
            position: "sticky",
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
                aria-label={t("nav.open")}
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
                <SheetTitle>{t("nav.sheetTitle")}</SheetTitle>
                <SheetDescription>
                  {t("nav.sheetDescription")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex h-full flex-col">
                <SidebarBrandHeader organizationName={organization?.name} />
                <WorkspaceContext organization={organization} />
                <div className="flex-1 overflow-y-auto px-3 pt-6 pb-4">
                  <NavList
                    navItems={primaryNavItems}
                    pathname={pathname}
                    search={searchString}
                    onNavigate={() => setMobileOpen(false)}
                    showInternalAdmin={showInternalAdmin}
                    showProspection={showProspection}
                  />
                </div>
                <div
                  className="border-t px-3 py-3"
                  style={{ borderColor: "var(--sidebar-border)" }}
                >
                  <SettingsRow
                    item={settingsNavItem}
                    pathname={pathname}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <div className="hidden min-w-0 shrink-0 items-center md:flex md:w-[220px]">
            <Breadcrumb
              pathname={pathname}
              workspaceLabel={t("shell.topbar.workspace")}
              t={t}
            />
          </div>

          <div
            className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 md:block md:w-[460px] lg:w-[520px]"
            style={{ top: "50%", transform: "translate(-50%, -50%)" }}
          >
            <div className="pointer-events-auto">
              <TopbarSearch
                placeholder={t("shell.topbar.searchPlaceholder")}
              />
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <NotificationsMenu label={t("shell.topbar.notifications")} />
            <CreateMenu createLabel={t("shell.topbar.create")} />

            <span
              aria-hidden
              className="hidden h-6 w-px sm:block"
              style={{ background: "rgba(255,255,255,.14)" }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full transition-colors"
                  aria-label={t("shell.userMenu")}
                >
                  <Avatar className="size-8 rounded-full ring-2 ring-[rgba(255,255,255,.18)] shadow-sm">
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
                      {getInitials(user.name) || "FD"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <span className="block text-sm">{user.name}</span>
                  <span className="text-muted-foreground block text-xs font-normal">
                    {t(`roles.${user.roleKey}`)}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">{t("shell.profile")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/support">{t("shell.help")}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut}>
                  {t("shell.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[92rem] px-3 py-4 sm:px-6 sm:py-5 lg:px-7">
          {children}
        </main>
      </div>
    </div>
  );
}
