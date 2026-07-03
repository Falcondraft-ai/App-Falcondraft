"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  ChevronDown,
  ChevronsUpDown,
  FileSignature,
  FileText,
  FolderInput,
  FolderOpen,
  HardDrive,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AgentChat } from "@/components/broker/agent-chat";
import { CourtierNotifications } from "@/components/broker/courtier-notifications";
import { CourtierTopbarSearch } from "@/components/broker/courtier-topbar-search";
import { type StorageUsage } from "@/lib/broker/storage";

const EXPANDED_WIDTH = 256;
const COLLAPSED_WIDTH = 72;
const FLYOUT_WIDTH = 210;
const FLYOUT_CLOSE_DELAY = 120;
const COLLAPSE_KEY = "courtier-sidebar-collapsed";
const EASE = [0.16, 1, 0.3, 1] as const;

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
  submenu?: NavSubItem[];
};

type NavSection = { label: string | null; items: NavItem[] };

const baseNavSections: NavSection[] = [
  {
    label: null,
    items: [
      { href: "/courtier", label: "Tableau de bord", icon: LayoutDashboard },
    ],
  },
  {
    label: "Gestion",
    items: [
      {
        href: "/courtier/clients",
        label: "Dossiers clients",
        icon: Users,
        submenu: [
          { href: "/courtier/clients", label: "Tous les dossiers" },
          {
            href: "/courtier/clients/new",
            label: "+ Nouveau dossier",
            highlight: true,
          },
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
      { href: "/courtier/documents", label: "Documents", icon: FolderOpen },
      {
        href: "/courtier/import",
        label: "Importer des clients",
        icon: FolderInput,
      },
    ],
  },
  {
    label: "Communication",
    items: [{ href: "/courtier/inbox", label: "Assistant Outlook", icon: Mail }],
  },
];

// Commercial proposal-automation module — only mounted for the "courtier SaaS"
// offering (hasProposalAutomation). Lives under /courtier/propositions so it
// never collides with the broker's own GED at /courtier/documents.
const proposalsSection: NavSection = {
  label: "Propositions",
  items: [
    {
      href: "/courtier/propositions/deals",
      label: "Propositions",
      icon: FileSignature,
      submenu: [
        {
          href: "/courtier/propositions/deals",
          label: "Toutes les propositions",
        },
        {
          href: "/courtier/propositions/deals/new",
          label: "+ Nouvelle proposition",
          highlight: true,
        },
      ],
    },
    {
      href: "/courtier/propositions/transcripts",
      label: "Transcripts",
      icon: Mic,
      submenu: [
        {
          href: "/courtier/propositions/transcripts",
          label: "Mes transcripts",
        },
        {
          href: "/courtier/propositions/transcripts/recall",
          label: "Récupérer un appel",
        },
        {
          href: "/courtier/propositions/transcripts/new",
          label: "+ Nouveau transcript",
          highlight: true,
        },
      ],
    },
    {
      href: "/courtier/propositions/documents",
      label: "Documents",
      icon: FileText,
    },
    {
      href: "/courtier/propositions/archive",
      label: "Archives",
      icon: Archive,
    },
  ],
};

// Commissions & Sinistres belong to the SaaS broker offering only — the bespoke
// ("sur mesure") broker doesn't use them.
const saasGestionItems: NavItem[] = [
  { href: "/courtier/commissions", label: "Commissions", icon: Wallet },
  { href: "/courtier/sinistres", label: "Sinistres", icon: ShieldAlert },
];

/**
 * SaaS brokers also get the proposal-automation module (inserted before the
 * Communication section) plus the Commissions/Sinistres items in the Gestion
 * section. Bespoke ("sur mesure") brokers keep the trimmed base nav only.
 */
function buildNavSections(showProposals: boolean): NavSection[] {
  if (!showProposals) return baseNavSections;
  const sections = baseNavSections.map((section) =>
    section.label === "Gestion"
      ? { ...section, items: [...section.items, ...saasGestionItems] }
      : section,
  );
  sections.splice(sections.length - 1, 0, proposalsSection);
  return sections;
}

const settingsItem: NavItem = {
  href: "/courtier/settings",
  label: "Paramètres",
  icon: Settings,
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

export type CourtierShellUser = {
  name: string;
  email: string;
  roleKey: string;
};

function isActive(pathname: string, href: string) {
  if (href === "/courtier") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupIsActive(pathname: string, item: NavItem) {
  if (isActive(pathname, item.href)) return true;
  return (item.submenu ?? []).some((s) => pathname === s.href.split("?")[0]);
}

// ---------------------------------------------------------------------------
// Brand header — with an integrated collapse toggle
// ---------------------------------------------------------------------------
function BrandHeader({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle?: () => void;
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
        <Link href="/courtier" aria-label="FalconDraft" className="flex">
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
        href="/courtier"
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
          <span
            className="mt-[1px] block text-[10.5px] font-medium uppercase"
            style={{ color: "var(--sidebar-text)", letterSpacing: "0.09em" }}
          >
            Espace courtier
          </span>
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
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      ) : null}
    </Link>
  );
}

function NavGroup({
  item,
  pathname,
  collapsed,
  open,
  onToggle,
  onNavigate,
  onMouseEnter,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  onMouseEnter?: React.MouseEventHandler<HTMLElement>;
}) {
  const { icon: Icon } = item;
  const active = groupIsActive(pathname, item);
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
                const subActive =
                  pathname === s.href.split("?")[0] && !s.highlight;
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

// ---------------------------------------------------------------------------
// Collapsed flyout
// ---------------------------------------------------------------------------
function FlyoutPanel({
  items,
  pathname,
  top,
  left,
  onNavigate,
  onMouseEnter,
  onMouseLeave,
}: {
  items: NavSubItem[];
  pathname: string;
  top: number;
  left: number;
  onNavigate?: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <motion.div
      key="courtier-flyout"
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
        border: "1px solid var(--border-1)",
        borderRadius: 8,
        boxShadow: "var(--shadow-lg)",
      }}
      role="menu"
    >
      {items.map((item) => {
        const active = pathname === item.href.split("?")[0] && !item.highlight;
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

// ---------------------------------------------------------------------------
// Storage gauge (expanded only)
// ---------------------------------------------------------------------------
function StorageGauge({ usage }: { usage: StorageUsage }) {
  const barColor =
    usage.level === "full" || usage.level === "critical"
      ? "var(--destructive)"
      : usage.level === "warning"
        ? "var(--warning)"
        : "var(--accent)";
  return (
    <Link
      href="/courtier/settings/stockage"
      className="block rounded-[8px] px-3 py-2.5 transition-colors hover:bg-[var(--sidebar-hover)]"
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
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Account block (in the sidebar, replaces the top-right avatar)
// ---------------------------------------------------------------------------
function AccountBlock({
  user,
  collapsed,
  profilePhotoUrl,
  onSignOut,
}: {
  user: CourtierShellUser;
  collapsed: boolean;
  profilePhotoUrl: string | null;
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

  const role = roleLabels[user.roleKey] ?? "Collaborateur";

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
          aria-label="Menu du compte"
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
                  {role}
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
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={10}
        className="w-[252px] overflow-hidden rounded-xl p-0"
      >
        {/* Branded header — dark navy strip, matches the sidebar */}
        <div
          className="flex items-center gap-3 px-3.5 py-3.5"
          style={{
            background:
              "linear-gradient(135deg, var(--sidebar-bg) 0%, #16203a 100%)",
          }}
        >
          <Avatar className="size-10 shrink-0 rounded-[12px] ring-1 ring-white/10">
            {profilePhotoUrl ? (
              <AvatarImage
                src={profilePhotoUrl}
                alt=""
                className="rounded-[12px]"
              />
            ) : null}
            <AvatarFallback
              className="rounded-[12px] text-[13px] font-semibold tracking-[0.02em]"
              style={{
                background: "linear-gradient(155deg, #283450, #181f31)",
                color: "var(--accent)",
              }}
            >
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p
              className="truncate text-[13.5px] font-semibold"
              style={{ color: "#FFFFFF" }}
            >
              {user.name}
            </p>
            <p
              className="truncate text-[11.5px]"
              style={{ color: "var(--sidebar-text)" }}
            >
              {user.email}
            </p>
            <span
              className="mt-1.5 inline-flex items-center rounded-full px-2 py-[1px] text-[10px] font-semibold uppercase tracking-[0.06em]"
              style={{
                background: "rgba(184,146,42,0.16)",
                color: "var(--accent)",
              }}
            >
              {role}
            </span>
          </div>
        </div>

        <div className="p-1.5">
          <DropdownMenuItem
            asChild
            className="cursor-pointer rounded-lg px-2.5 py-2 text-[13px]"
          >
            <Link href="/courtier/settings" className="flex items-center gap-2.5">
              <Settings
                className="size-4 text-[var(--fg-3)]"
                strokeWidth={1.75}
              />
              Paramètres
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            className="cursor-pointer rounded-lg px-2.5 py-2 text-[13px]"
          >
            <a
              href="mailto:support@falcondraft.com"
              className="flex items-center gap-2.5"
            >
              <HelpCircle
                className="size-4 text-[var(--fg-3)]"
                strokeWidth={1.75}
              />
              Aide & support
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1.5" />
          <DropdownMenuItem
            onSelect={onSignOut}
            className="cursor-pointer rounded-lg px-2.5 py-2 text-[13px] font-medium text-[var(--destructive)] focus:bg-[var(--destructive-soft)] focus:text-[var(--destructive)]"
          >
            <LogOut className="size-4" strokeWidth={1.75} />
            Se déconnecter
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Sidebar content (desktop rail + mobile sheet)
// ---------------------------------------------------------------------------
function SidebarContent({
  sections,
  pathname,
  collapsed,
  usage,
  user,
  profilePhotoUrl,
  openGroups,
  onToggleGroup,
  onToggleCollapse,
  onSignOut,
  onNavigate,
  onFlyoutOpen,
  onFlyoutClose,
}: {
  sections: NavSection[];
  pathname: string;
  collapsed: boolean;
  usage: StorageUsage;
  user: CourtierShellUser;
  profilePhotoUrl: string | null;
  openGroups: Set<string>;
  onToggleGroup: (href: string) => void;
  onToggleCollapse?: () => void;
  onSignOut: () => void;
  onNavigate?: () => void;
  onFlyoutOpen?: (top: number, items: NavSubItem[]) => void;
  onFlyoutClose?: () => void;
}) {
  return (
    <>
      <BrandHeader collapsed={collapsed} onToggle={onToggleCollapse} />

      <div className="flex-1 overflow-y-auto px-2.5 pt-3 pb-3">
        <nav className="space-y-1" aria-label="Navigation courtier">
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
              ) : null}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const hasSub = Boolean(item.submenu && item.submenu.length > 0);
                  if (!hasSub) {
                    return (
                      <NavLink
                        key={item.href}
                        item={item}
                        active={isActive(pathname, item.href)}
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
        className="space-y-1.5 border-t px-2.5 pb-2.5 pt-2.5"
        style={{ borderColor: "var(--sidebar-border)" }}
        onMouseEnter={() => onFlyoutClose?.()}
      >
        {!collapsed ? <StorageGauge usage={usage} /> : null}
        <NavLink
          item={settingsItem}
          active={isActive(pathname, settingsItem.href)}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        <div
          className="border-t pt-1.5"
          style={{ borderColor: "var(--sidebar-border)" }}
        >
          <AccountBlock
            user={user}
            collapsed={collapsed}
            profilePhotoUrl={profilePhotoUrl}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------
export function CourtierShell({
  children,
  organizationName,
  user,
  usage,
  showProposals = false,
}: {
  children: React.ReactNode;
  organizationName: string;
  user: CourtierShellUser;
  usage: StorageUsage;
  showProposals?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const navSections = buildNavSections(showProposals);
  const allNavItems = navSections.flatMap((s) => s.items);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = React.useState<string | null>(
    null,
  );
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(() => {
    const init = new Set<string>();
    for (const item of allNavItems) {
      if (item.submenu && groupIsActive(pathname, item)) init.add(item.href);
    }
    return init;
  });
  const [flyout, setFlyout] = React.useState<{
    items: NavSubItem[];
    top: number;
  } | null>(null);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstNavRef = React.useRef(true);

  // Persisted collapse preference (SSR-safe).
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

  // Auto-collapse the rail when navigating to a page (keeps focus on content).
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
      const top = Math.max(
        12,
        Math.min(anchorTop, viewportH - (items.length * 40 + 16)),
      );
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
    toast.success("Vous êtes déconnecté.");
    router.replace("/login");
    router.refresh();
  }, [router]);

  const railWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <div
      className="bg-background text-foreground min-h-dvh"
      style={{ "--sb-w": `${railWidth}px` } as React.CSSProperties}
    >
      {/* Desktop rail */}
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
          sections={navSections}
          pathname={pathname}
          collapsed={collapsed}
          usage={usage}
          user={user}
          profilePhotoUrl={profilePhotoUrl}
          openGroups={openGroups}
          onToggleGroup={toggleGroup}
          onToggleCollapse={toggleCollapsed}
          onSignOut={signOut}
          onFlyoutOpen={collapsed ? openFlyout : undefined}
          onFlyoutClose={scheduleClose}
        />

        <AnimatePresence>
          {flyout ? (
            <FlyoutPanel
              items={flyout.items}
              pathname={pathname}
              top={flyout.top}
              left={railWidth}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              onNavigate={() => setFlyout(null)}
            />
          ) : null}
        </AnimatePresence>
      </aside>

      {/* Content */}
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
                <SidebarContent
                  sections={navSections}
                  pathname={pathname}
                  collapsed={false}
                  usage={usage}
                  user={user}
                  profilePhotoUrl={profilePhotoUrl}
                  openGroups={openGroups}
                  onToggleGroup={toggleGroup}
                  onSignOut={signOut}
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
              <CourtierTopbarSearch placeholder="Rechercher un client, une compagnie, un RIB, une adresse…" />
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
          </div>
        </header>

        <main className="mx-auto w-full max-w-[92rem] px-3 py-4 sm:px-6 sm:py-5 lg:px-7">
          {children}
        </main>
      </div>

      <AgentChat userName={user.name} />
    </div>
  );
}
