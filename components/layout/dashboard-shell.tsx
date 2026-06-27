"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Euro,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
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

const EXPANDED_WIDTH = 256;
const COLLAPSED_WIDTH = 72;
const FLYOUT_WIDTH = 208;
const FLYOUT_CLOSE_DELAY = 120;
const COLLAPSE_KEY = "dashboard-sidebar-collapsed";
const EASE = [0.16, 1, 0.3, 1] as const;

type NavSubItem = {
  label: string;
  href: string;
  highlight?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  submenu?: NavSubItem[];
  badge?: string;
};

type NavSection = { label: string | null; items: NavItem[] };

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isSubItemActive(
  pathname: string,
  search: string,
  itemHref: string,
): boolean {
  const [path, query] = itemHref.split("?");
  if (pathname !== path) return false;
  if (!query) return !search || search === "?";
  const expected = new URLSearchParams(query);
  const current = new URLSearchParams(search);
  for (const [key, value] of expected.entries()) {
    if (current.get(key) !== value) return false;
  }
  return true;
}

function groupIsActive(pathname: string, search: string, item: NavItem) {
  if (isNavItemActive(pathname, item.href)) return true;
  return (item.submenu ?? []).some((s) => isSubItemActive(pathname, search, s.href));
}

type DashboardShellUser = {
  name: string;
  email: string;
  roleKey: WorkspaceMemberRole;
};

type DashboardShellOrganization = { name: string };

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

function buildNavSections(
  t: (key: TranslationKey) => string,
  showInternalAdmin: boolean,
  showProspection: boolean,
  canManageBilling: boolean,
): NavSection[] {
  const sections: NavSection[] = [
    {
      label: null,
      items: [
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
        {
          href: "/dashboard/documents",
          label: t("nav.documents"),
          icon: FileText,
        },
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
          badge: t("nav.comingSoon"),
        },
        {
          href: "/dashboard/workflows",
          label: t("nav.workflows"),
          icon: Workflow,
          badge: t("nav.comingSoon"),
        },
        { href: "/dashboard/archive", label: t("nav.archives"), icon: Archive },
      ],
    },
  ];

  const internal: NavItem[] = [];
  if (showInternalAdmin) {
    internal.push({
      href: "/admin",
      label: t("nav.internalAdmin"),
      icon: ShieldCheck,
      badge: t("nav.internalBadge"),
    });
  }
  if (showProspection) {
    internal.push({
      href: "/prospection",
      label: t("nav.prospection"),
      icon: Target,
      badge: t("nav.internalBadge"),
    });
  }
  if (internal.length) {
    sections.push({ label: t("nav.internal"), items: internal });
  }

  const settingsSubmenu: NavSubItem[] = [
    { label: t("settings.nav.general"), href: "/dashboard/settings" },
    { label: t("settings.nav.team"), href: "/dashboard/settings/team" },
    { label: t("settings.nav.integrations"), href: "/dashboard/settings/integrations" },
    ...(canManageBilling
      ? [{ label: t("settings.nav.billing"), href: "/dashboard/settings/billing" }]
      : []),
  ];
  sections.push({
    label: null,
    items: [
      {
        href: "/dashboard/settings",
        label: t("nav.settings"),
        icon: Settings,
        submenu: settingsSubmenu,
      },
    ],
  });

  return sections;
}

// ---------------------------------------------------------------------------
// Brand header (with integrated collapse toggle)
// ---------------------------------------------------------------------------
function BrandHeader({
  collapsed,
  onToggle,
  organizationName,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  organizationName?: string | null;
}) {
  const toggleBtn = onToggle ? (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
      title={collapsed ? "Déplier" : "Replier"}
      className="flex size-7 items-center justify-center rounded-[7px] transition-colors hover:bg-[var(--sidebar-hover)]"
      style={{ color: "var(--sidebar-text)" }}
    >
      {collapsed ? (
        <PanelLeftOpen className="size-[18px]" strokeWidth={1.75} />
      ) : (
        <PanelLeftClose className="size-[18px]" strokeWidth={1.75} />
      )}
    </button>
  ) : null;

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center gap-2 border-b px-2 py-3"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <Link href="/dashboard" aria-label="FalconDraft" className="flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bimi/logo.svg"
            alt=""
            aria-hidden="true"
            className="size-9 scale-[1.12] object-contain"
          />
        </Link>
        {toggleBtn}
      </div>
    );
  }

  return (
    <div
      className="flex h-16 items-center justify-between border-b pl-3.5 pr-2.5"
      style={{ borderColor: "var(--sidebar-border)" }}
    >
      <Link
        href="/dashboard"
        className="flex min-w-0 items-center gap-2.5"
        aria-label="FalconDraft"
      >
        <span className="flex size-9 shrink-0 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bimi/logo.svg"
            alt=""
            aria-hidden="true"
            className="size-9 scale-[1.12] object-contain"
          />
        </span>
        <span className="min-w-0 leading-tight">
          <span
            className="block text-[15.5px] font-semibold tracking-[-0.025em]"
            style={{ color: "var(--sidebar-text-active)" }}
          >
            FalconDraft
          </span>
          {organizationName ? (
            <span
              className="mt-[1px] block truncate text-[10.5px] font-medium uppercase"
              style={{ color: "var(--sidebar-text)", letterSpacing: "0.09em" }}
            >
              {organizationName}
            </span>
          ) : null}
        </span>
      </Link>
      {toggleBtn}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav rows
// ---------------------------------------------------------------------------
function rowBaseClass(active: boolean) {
  return cn(
    "group flex items-center rounded-[8px] border-l-2 text-[13px]",
    "transition-[background-color,color,border-color] duration-150 ease-out",
    !active &&
      "hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-active)]",
  );
}

function rowStyle(active: boolean): React.CSSProperties {
  return active
    ? {
        color: "var(--sidebar-text-active)",
        backgroundColor: "var(--sidebar-active)",
        borderLeftColor: "var(--accent)",
        fontWeight: 500,
      }
    : { color: "var(--sidebar-text)", borderLeftColor: "transparent" };
}

function BadgePill({ text }: { text: string }) {
  return (
    <span
      className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: "rgba(184,146,42,0.12)",
        color: "var(--accent)",
        borderRadius: "4px",
      }}
    >
      {text}
    </span>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { icon: Icon } = item;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        rowBaseClass(active),
        "h-9",
        collapsed ? "justify-center px-0" : "gap-2.5 pl-[13px] pr-2.5",
      )}
      style={rowStyle(active)}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badge ? <BadgePill text={item.badge} /> : null}
        </>
      ) : null}
    </Link>
  );
}

function NavGroup({
  item,
  pathname,
  search,
  collapsed,
  open,
  onToggle,
  onNavigate,
  onMouseEnter,
}: {
  item: NavItem;
  pathname: string;
  search: string;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  onMouseEnter?: React.MouseEventHandler<HTMLElement>;
}) {
  const { icon: Icon } = item;
  const active = groupIsActive(pathname, search, item);
  const sub = item.submenu ?? [];

  if (collapsed) {
    return (
      <button
        type="button"
        onMouseEnter={onMouseEnter}
        title={item.label}
        className={cn(rowBaseClass(active), "h-9 w-full justify-center px-0")}
        style={rowStyle(active)}
        aria-label={item.label}
      >
        <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(rowBaseClass(active), "h-9 w-full gap-2.5 pl-[13px] pr-2.5")}
        style={rowStyle(active)}
        aria-expanded={open}
      >
        <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        <ChevronDown
          className={cn(
            "size-[15px] shrink-0 opacity-60 transition-transform duration-200",
            open && "rotate-180",
          )}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden"
          >
            <div
              className="ml-[26px] mt-0.5 space-y-0.5 border-l pb-1 pl-2.5"
              style={{ borderColor: "var(--sidebar-border)" }}
            >
              {sub.map((s) => {
                const subActive = isSubItemActive(pathname, search, s.href);
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    onClick={onNavigate}
                    className="block rounded-[6px] px-2.5 py-1.5 text-[12.5px] transition-colors duration-150"
                    style={
                      subActive
                        ? {
                            color: "var(--sidebar-text-active)",
                            backgroundColor: "var(--sidebar-hover)",
                            fontWeight: 500,
                          }
                        : {
                            color: s.highlight
                              ? "var(--accent)"
                              : "var(--sidebar-text)",
                            fontWeight: s.highlight ? 500 : 400,
                          }
                    }
                  >
                    {s.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function FlyoutPanel({
  items,
  pathname,
  search,
  top,
  left,
  onNavigate,
  onMouseEnter,
  onMouseLeave,
}: {
  items: NavSubItem[];
  pathname: string;
  search: string;
  top: number;
  left: number;
  onNavigate?: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <motion.div
      key="dashboard-flyout"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-40 p-1.5"
      style={{
        left,
        top,
        width: FLYOUT_WIDTH,
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
                    color: item.highlight ? "var(--accent)" : "var(--foreground)",
                    fontWeight: item.highlight ? 500 : 400,
                  }
            }
            onMouseEnter={(event) => {
              if (active) return;
              event.currentTarget.style.backgroundColor = "var(--background-subtle)";
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

// ---------------------------------------------------------------------------
// Account block (in the sidebar; replaces the top-right avatar)
// ---------------------------------------------------------------------------
function AccountBlock({
  user,
  collapsed,
  profilePhotoUrl,
  roleLabel,
  profileLabel,
  helpLabel,
  signOutLabel,
  onSignOut,
}: {
  user: DashboardShellUser;
  collapsed: boolean;
  profilePhotoUrl: string | null;
  roleLabel: string;
  profileLabel: string;
  helpLabel: string;
  signOutLabel: string;
  onSignOut: () => void;
}) {
  const avatar = (
    <Avatar className="size-9 shrink-0 rounded-full ring-1 ring-white/10">
      {profilePhotoUrl ? (
        <AvatarImage src={profilePhotoUrl} alt="" className="rounded-full" />
      ) : null}
      <AvatarFallback
        className="rounded-full text-[12px] font-semibold tracking-[0.02em]"
        style={{
          background: "linear-gradient(155deg, #283450, #181f31)",
          color: "var(--accent)",
        }}
      >
        {getInitials(user.name)}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={collapsed ? user.name : undefined}
          className={cn(
            "flex w-full items-center rounded-[10px] transition-colors hover:bg-[var(--sidebar-hover)]",
            collapsed ? "justify-center p-1" : "gap-2.5 p-1.5",
          )}
          aria-label={user.name}
        >
          {avatar}
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1 text-left leading-tight">
                <span
                  className="block truncate text-[13px] font-medium"
                  style={{ color: "var(--sidebar-text-active)" }}
                >
                  {user.name}
                </span>
                <span
                  className="block truncate text-[11px]"
                  style={{ color: "var(--sidebar-text)" }}
                >
                  {roleLabel}
                </span>
              </span>
              <ChevronsUpDown
                className="size-4 shrink-0"
                strokeWidth={1.75}
                style={{ color: "var(--sidebar-text)" }}
                aria-hidden="true"
              />
            </>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel>
          <span className="block text-sm">{user.name}</span>
          <span className="text-muted-foreground block text-xs font-normal">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">{profileLabel}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/support">{helpLabel}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut} className="flex items-center gap-2">
          <LogOut className="size-4" strokeWidth={1.75} />
          {signOutLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Sidebar content
// ---------------------------------------------------------------------------
function SidebarContent({
  sections,
  pathname,
  search,
  collapsed,
  user,
  profilePhotoUrl,
  roleLabel,
  profileLabel,
  helpLabel,
  signOutLabel,
  openGroups,
  onToggleGroup,
  onToggleCollapse,
  organizationName,
  onSignOut,
  onNavigate,
  onFlyoutOpen,
  onFlyoutClose,
}: {
  sections: NavSection[];
  pathname: string;
  search: string;
  collapsed: boolean;
  user: DashboardShellUser;
  profilePhotoUrl: string | null;
  roleLabel: string;
  profileLabel: string;
  helpLabel: string;
  signOutLabel: string;
  openGroups: Set<string>;
  onToggleGroup: (href: string) => void;
  onToggleCollapse?: () => void;
  organizationName?: string | null;
  onSignOut: () => void;
  onNavigate?: () => void;
  onFlyoutOpen?: (top: number, items: NavSubItem[]) => void;
  onFlyoutClose?: () => void;
}) {
  return (
    <>
      <BrandHeader
        collapsed={collapsed}
        onToggle={onToggleCollapse}
        organizationName={organizationName}
      />

      <div className="flex-1 overflow-y-auto px-2.5 pt-3 pb-3">
        <nav className="space-y-1" aria-label="Navigation">
          {sections.map((section, si) => (
            <div key={section.label ?? `s${si}`} className={cn(si > 0 && "pt-1.5")}>
              {section.label ? (
                collapsed ? (
                  <div
                    className="mx-auto mb-1.5 h-px w-7"
                    style={{ background: "var(--sidebar-border)" }}
                  />
                ) : (
                  <p
                    className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase"
                    style={{
                      color: "var(--sidebar-text)",
                      letterSpacing: "0.11em",
                      opacity: 0.6,
                    }}
                  >
                    {section.label}
                  </p>
                )
              ) : si > 0 && collapsed ? (
                <div
                  className="mx-auto mb-1.5 h-px w-7"
                  style={{ background: "var(--sidebar-border)" }}
                />
              ) : null}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const hasSub = Boolean(item.submenu && item.submenu.length > 0);
                  if (!hasSub) {
                    return (
                      <NavLink
                        key={item.href}
                        item={item}
                        active={isNavItemActive(pathname, item.href)}
                        collapsed={collapsed}
                        onNavigate={onNavigate}
                      />
                    );
                  }
                  return (
                    <NavGroup
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      search={search}
                      collapsed={collapsed}
                      open={openGroups.has(item.href)}
                      onToggle={() => onToggleGroup(item.href)}
                      onNavigate={onNavigate}
                      onMouseEnter={
                        collapsed && onFlyoutOpen
                          ? (event) => {
                              const rect =
                                event.currentTarget.getBoundingClientRect();
                              onFlyoutOpen(rect.top, item.submenu ?? []);
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div
        className="border-t px-2.5 pb-2.5 pt-2.5"
        style={{ borderColor: "var(--sidebar-border)" }}
        onMouseEnter={() => onFlyoutClose?.()}
      >
        <AccountBlock
          user={user}
          collapsed={collapsed}
          profilePhotoUrl={profilePhotoUrl}
          roleLabel={roleLabel}
          profileLabel={profileLabel}
          helpLabel={helpLabel}
          signOutLabel={signOutLabel}
          onSignOut={onSignOut}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumb (topbar)
// ---------------------------------------------------------------------------
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
    if (pathname === "/dashboard/deals/new") segments.push({ label: t("common.actions.newDeal") });
    else if (pathname !== "/dashboard/deals") segments.push({ label: "Détail" });
    return segments;
  }
  if (pathname.startsWith("/dashboard/transcripts")) {
    const segments: BreadcrumbSegment[] = [
      { label: workspaceLabel },
      { label: t("nav.transcripts"), href: "/dashboard/transcripts" },
    ];
    if (pathname === "/dashboard/transcripts/new") segments.push({ label: "Nouveau" });
    else if (pathname === "/dashboard/transcripts/recall") segments.push({ label: "Récupérer" });
    else if (pathname !== "/dashboard/transcripts") segments.push({ label: "Détail" });
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
    <nav className="flex min-w-0 items-center gap-1.5" aria-label="Breadcrumb">
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
          <Plus className="size-3.5" strokeWidth={2.25} style={{ color: "var(--accent)" }} />
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
            <FolderOpen className="size-3.5 text-[var(--brand-navy-700)]" strokeWidth={1.75} />
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
            <Mic className="size-3.5 text-[var(--brand-navy-700)]" strokeWidth={1.75} />
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
            <Euro className="size-3.5 text-[var(--fg-4)]" strokeWidth={1.75} />
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

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------
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
  const [collapsed, setCollapsed] = React.useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = React.useState<string | null>(null);
  const [searchString, setSearchString] = React.useState("");
  const [flyout, setFlyout] = React.useState<{
    items: NavSubItem[];
    top: number;
  } | null>(null);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstNavRef = React.useRef(true);

  const sections = React.useMemo(
    () => buildNavSections(t, showInternalAdmin, showProspection, canManageBilling),
    [t, showInternalAdmin, showProspection, canManageBilling],
  );

  const [openGroups, setOpenGroups] = React.useState<Set<string>>(() => {
    const init = new Set<string>();
    for (const section of sections) {
      for (const item of section.items) {
        if (item.submenu && groupIsActive(pathname, "", item)) init.add(item.href);
      }
    }
    return init;
  });

  React.useEffect(() => {
    if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
  }, []);
  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
    setFlyout(null);
  }, []);

  // Auto-collapse the rail on navigation.
  React.useEffect(() => {
    if (firstNavRef.current) {
      firstNavRef.current = false;
      return;
    }
    setCollapsed(true);
    setFlyout(null);
  }, [pathname]);

  const toggleGroup = React.useCallback((href: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }, []);

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
    closeTimerRef.current = setTimeout(() => setFlyout(null), FLYOUT_CLOSE_DELAY);
  }, [cancelClose]);
  const openFlyout = React.useCallback(
    (anchorTop: number, items: NavSubItem[]) => {
      cancelClose();
      const viewportH = typeof window !== "undefined" ? window.innerHeight : 1000;
      const top = Math.max(12, Math.min(anchorTop, viewportH - (items.length * 38 + 16)));
      setFlyout({ items, top });
    },
    [cancelClose],
  );

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

  const signOut = React.useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    toast.success(t("shell.signOutSuccess"));
    router.replace("/login");
    router.refresh();
  }, [router, t]);

  const railWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const roleLabel = t(`roles.${user.roleKey}` as TranslationKey);
  const sidebarProps = {
    sections,
    pathname,
    search: searchString,
    user,
    profilePhotoUrl,
    roleLabel,
    profileLabel: t("shell.profile"),
    helpLabel: t("shell.help"),
    signOutLabel: t("shell.signOut"),
    openGroups,
    onToggleGroup: toggleGroup,
    organizationName: organization?.name,
    onSignOut: signOut,
  };

  return (
    <div
      className="bg-background text-foreground min-h-dvh"
      style={{ "--sb-w": `${railWidth}px` } as React.CSSProperties}
    >
      <aside
        onMouseLeave={scheduleClose}
        className="fixed inset-y-0 left-0 z-30 hidden border-r transition-[width] duration-200 ease-out lg:flex lg:w-[var(--sb-w)] lg:flex-col"
        style={{
          backgroundColor: "var(--sidebar-bg)",
          borderColor: "var(--sidebar-border)",
          color: "var(--sidebar-text)",
        }}
      >
        <SidebarContent
          {...sidebarProps}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          onFlyoutOpen={collapsed ? openFlyout : undefined}
          onFlyoutClose={scheduleClose}
        />

        <AnimatePresence>
          {flyout ? (
            <FlyoutPanel
              items={flyout.items}
              pathname={pathname}
              search={searchString}
              top={flyout.top}
              left={railWidth}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              onNavigate={() => setFlyout(null)}
            />
          ) : null}
        </AnimatePresence>
      </aside>

      <div className="min-h-dvh transition-[padding] duration-200 ease-out lg:pl-[var(--sb-w)]">
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
                <SheetDescription>{t("nav.sheetDescription")}</SheetDescription>
              </SheetHeader>
              <div className="flex h-full flex-col">
                <SidebarContent
                  {...sidebarProps}
                  collapsed={false}
                  onNavigate={() => setMobileOpen(false)}
                />
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
              <TopbarSearch placeholder={t("shell.topbar.searchPlaceholder")} />
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <NotificationsMenu label={t("shell.topbar.notifications")} />
            <CreateMenu createLabel={t("shell.topbar.create")} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[92rem] px-3 py-4 sm:px-6 sm:py-5 lg:px-7">
          {children}
        </main>
      </div>
    </div>
  );
}
