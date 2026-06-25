"use client";

import Link from "next/link";
import * as React from "react";
import {
  Bell,
  FileSignature,
  FileText,
  FolderPlus,
  PenLine,
  RefreshCw,
  ScrollText,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { brokerActivityLabel } from "@/lib/broker/activity";

type Notification = {
  id: string;
  type: string;
  description: string | null;
  clientId: string;
  createdAt: string;
};

const SEEN_KEY = "courtier-notif-seen-at";

const typeIcon: Record<string, React.ReactNode> = {
  client_created: <FolderPlus className="size-3.5" strokeWidth={1.75} />,
  status_changed: <RefreshCw className="size-3.5" strokeWidth={1.75} />,
  document_added: <FileText className="size-3.5" strokeWidth={1.75} />,
  document_deleted: <Trash2 className="size-3.5" strokeWidth={1.75} />,
  quote_imported: <ScrollText className="size-3.5" strokeWidth={1.75} />,
  quote_validated: <ScrollText className="size-3.5" strokeWidth={1.75} />,
  advice_created: <PenLine className="size-3.5" strokeWidth={1.75} />,
  advice_validated: <FileText className="size-3.5" strokeWidth={1.75} />,
  advice_signed: <FileSignature className="size-3.5" strokeWidth={1.75} />,
  advice_signature_prepared: (
    <FileSignature className="size-3.5" strokeWidth={1.75} />
  ),
  advice_outlook_draft: <FileText className="size-3.5" strokeWidth={1.75} />,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export function CourtierNotifications({ label }: { label: string }) {
  const [items, setItems] = React.useState<Notification[]>([]);
  const [seenAt, setSeenAt] = React.useState<number>(0);

  const load = React.useCallback(() => {
    void fetch("/api/courtier/notifications", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { notifications?: Notification[] }) => {
        if (Array.isArray(d?.notifications)) setItems(d.notifications);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    const stored = Number(window.localStorage.getItem(SEEN_KEY) ?? 0);
    setSeenAt(stored);
    load();
    const interval = window.setInterval(load, 60000);
    return () => window.clearInterval(interval);
  }, [load]);

  const unreadCount = items.filter(
    (n) => new Date(n.createdAt).getTime() > seenAt,
  ).length;

  function markSeen() {
    const now = Date.now();
    window.localStorage.setItem(SEEN_KEY, String(now));
    setSeenAt(now);
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          load();
          markSeen();
        }
      }}
    >
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
        >
          <Bell className="size-4" strokeWidth={1.75} />
          {unreadCount > 0 ? (
            <span
              className="absolute -right-1 -top-1 flex min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
              style={{ background: "var(--accent)", height: 16 }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0">
        <div
          className="border-b px-4 py-3"
          style={{ borderColor: "var(--border-1)" }}
        >
          <p className="text-[13px] font-semibold text-[var(--fg-1)]">
            Notifications
          </p>
          <p className="text-[11.5px] text-[var(--fg-3)]">
            L’activité récente de vos dossiers
          </p>
        </div>
        {items.length > 0 ? (
          <ul className="max-h-[360px] overflow-y-auto py-1">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/courtier/clients/${n.clientId}`}
                  className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--brand-navy-50)]"
                >
                  <span
                    className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: "var(--brand-navy-50)",
                      border: "1px solid var(--border-1)",
                      color: "var(--brand-navy-700)",
                    }}
                  >
                    {typeIcon[n.type] ?? (
                      <Bell className="size-3.5" strokeWidth={1.75} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] leading-5 text-[var(--fg-1)]">
                      {n.description ?? brokerActivityLabel(n.type)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--fg-4)]">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-[12.5px] text-[var(--fg-3)]">
            Aucune activité récente.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
