"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  ChevronRight,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Mic,
  Settings,
  ShieldCheck,
  Target,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/common/brand-mark";
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
  fetchProfilePhotoUrl,
  LEGACY_PROFILE_PHOTO_STORAGE_KEY,
  PROFILE_PHOTO_UPDATED_EVENT,
} from "@/lib/profile-photo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { WorkspaceMemberRole } from "@/lib/auth/workspace-permissions";
import type { TranslationKey } from "@/lib/i18n/translations";

const SIDEBAR_WIDTH = 280;
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
      className="border-b px-5 py-5"
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
          className="text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--sidebar-text)" }}
        >
          {t("shell.workspaceTitle")}
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
      className="flex items-center border-b px-5 py-5"
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
        <div className="h-10 w-10 flex items-center justify-center shrink-0">
          <img
            src="/bimi/logo.svg"
            alt=""
            aria-hidden="true"
            className="h-10 w-10 object-contain scale-[1.15]"
          />
        </div>
        <span className="min-w-0 leading-tight">
          <span
            className="block text-[15px] font-semibold tracking-[-0.025em]"
            style={{ color: "var(--sidebar-text-active)" }}
          >
            FalconDraft
          </span>
          {organizationName ? (
            <span
              className="block truncate text-[11px] font-medium mt-0.5"
              style={{ color: "var(--sidebar-text)" }}
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
          "group flex w-full items-center gap-3 rounded-[8px] border-l-2",
          "h-11 pl-[15px] pr-3 text-[13.5px]",
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
          className="size-[19px] shrink-0"
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
        <div className="flex-1 overflow-y-auto px-3 pt-6 pb-4">
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
          className="border-t px-3 pt-3 pb-4"
          style={{ borderColor: "var(--sidebar-border)" }}
        >
          <SettingsRow
            item={settingsNavItem}
            pathname={pathname}
            onSubmenuOpen={openSubmenu}
          />
          <p
            className="mt-4 px-1 text-[10.5px] font-medium tracking-[0.04em]"
            style={{ color: "var(--sidebar-text)", opacity: 0.5 }}
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

      <div className="min-h-dvh lg:pl-[280px]">
        <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="lg:hidden"
                    aria-label={t("nav.open")}
                  >
                    <Menu className="size-4" strokeWidth={1.75} />
                  </Button>
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
              <div className="lg:hidden">
                <BrandMark href="/dashboard" size="sm" showDescriptor={false} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="hover:bg-muted flex items-center gap-2 rounded-md p-1.5 transition-colors"
                    aria-label={t("shell.userMenu")}
                  >
                    <Avatar className="size-8 rounded-md after:rounded-md ring-2 ring-[var(--border-strong)] shadow-sm">
                      {profilePhotoUrl ? (
                        <AvatarImage
                          src={profilePhotoUrl}
                          alt=""
                          className="rounded-md"
                        />
                      ) : null}
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
          </div>
        </header>

        <main className="mx-auto w-full max-w-[92rem] px-3 py-4 sm:px-6 sm:py-5 lg:px-7">
          {children}
        </main>
      </div>
    </div>
  );
}
