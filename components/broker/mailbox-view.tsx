"use client";

import Link from "next/link";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Download,
  FolderOpen,
  Inbox,
  Loader2,
  Mail,
  Paperclip,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import { BrokerAvatar } from "@/components/broker/broker-avatar";
import { EmailBody } from "@/components/broker/email-body";
import { LinkEmailButton } from "@/components/broker/link-email-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MailboxMessage } from "@/app/api/courtier/mailbox/route";
import type { MailboxMessageDetail } from "@/app/api/courtier/mailbox/message/route";

type ListState =
  | { kind: "loading" }
  | { kind: "not_connected" }
  | { kind: "error"; message: string }
  | { kind: "ready"; messages: MailboxMessage[]; mailbox: string | null };

const WINDOWS = [7, 14, 30, 90] as const;

/**
 * La boîte email, telle quelle.
 *
 * Complément du briefing : celui-ci ne montre que ce qui appelle une action,
 * celle-ci montre TOUT, y compris ce qui a été écarté. Lecture IMAP seule —
 * consulter son courrier ne déclenche aucune analyse et ne coûte donc rien.
 */
export function MailboxView() {
  const [state, setState] = React.useState<ListState>({ kind: "loading" });
  const [query, setQuery] = React.useState("");
  const [days, setDays] = React.useState<number>(14);
  const [selected, setSelected] = React.useState<MailboxMessage | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(
    async (opts: { days: number; silent?: boolean }) => {
      if (!opts.silent) setState({ kind: "loading" });
      const res = await fetch(
        `/api/courtier/mailbox?days=${opts.days}&limit=200`,
      ).catch(() => null);
      const data = (await res?.json().catch(() => null)) as
        | { messages?: MailboxMessage[]; mailbox?: string; reason?: string; message?: string }
        | null;

      if (data?.reason === "not_connected") {
        setState({ kind: "not_connected" });
        return;
      }
      if (!res?.ok) {
        setState({
          kind: "error",
          message: data?.message ?? "La boîte n’a pas répondu.",
        });
        return;
      }
      setState({
        kind: "ready",
        messages: data?.messages ?? [],
        mailbox: data?.mailbox ?? null,
      });
    },
    [],
  );

  React.useEffect(() => {
    void load({ days });
  }, [days, load]);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    await load({ days, silent: true });
    setRefreshing(false);
  }

  const visible = React.useMemo(() => {
    if (state.kind !== "ready") return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return state.messages;
    return state.messages.filter((m) =>
      [m.subject, m.from, m.fromEmail, m.preview].some((f) =>
        f.toLowerCase().includes(needle),
      ),
    );
  }, [state, query]);

  const linkedCount =
    state.kind === "ready"
      ? state.messages.filter((m) => m.linkedClient).length
      : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--fg-4)]"
            strokeWidth={1.75}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans vos emails…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              className="rounded-md border px-2.5 py-1.5 text-[12px] transition-colors"
              style={{
                borderColor: days === w ? "var(--accent)" : "var(--border-1)",
                background:
                  days === w ? "var(--accent-soft)" : "var(--bg-surface)",
                color: days === w ? "var(--accent-foreground)" : "var(--fg-2)",
              }}
            >
              {w} j
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void refresh()}
          disabled={refreshing || state.kind === "loading"}
          className="inline-flex items-center gap-1.5"
        >
          <RefreshCw
            className={cn("size-3.5", refreshing && "animate-spin")}
            strokeWidth={1.75}
          />
          Actualiser
        </Button>
      </div>

      {state.kind === "ready" ? (
        <p className="text-[12px] text-[var(--fg-4)]">
          {visible.length} email{visible.length > 1 ? "s" : ""}
          {state.mailbox ? ` · ${state.mailbox}` : ""}
          {linkedCount > 0
            ? ` · ${linkedCount} rattaché${linkedCount > 1 ? "s" : ""} à un dossier`
            : ""}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Liste */}
        <div
          className="overflow-hidden rounded-xl border bg-[var(--bg-surface)]"
          style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
        >
          {state.kind === "loading" ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg"
                  style={{ background: "var(--bg-sunken)" }}
                />
              ))}
            </div>
          ) : state.kind === "not_connected" ? (
            <Guidance
              title="Aucune boîte reliée à ce profil"
              hint="Reliez une boîte email pour consulter votre courrier ici."
              action={
                <Button asChild size="sm">
                  <Link href="/courtier/settings/integrations">
                    Connecter une boîte
                  </Link>
                </Button>
              }
            />
          ) : state.kind === "error" ? (
            <Guidance title="Boîte injoignable" hint={state.message} />
          ) : visible.length === 0 ? (
            <Guidance
              title={query ? "Aucun email ne correspond" : "Aucun email"}
              hint={
                query
                  ? "Essayez d’autres mots-clés."
                  : `Rien reçu sur les ${days} derniers jours.`
              }
            />
          ) : (
            <ul className="max-h-[70vh] divide-y overflow-y-auto" style={{ borderColor: "var(--border-1)" }}>
              {visible.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(m)}
                    className={cn(
                      "flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[var(--bg-sunken)]",
                      selected?.id === m.id && "bg-[var(--bg-sunken)]",
                    )}
                  >
                    <BrokerAvatar name={m.from} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                          {m.from}
                        </span>
                        {m.hasAttachments ? (
                          <Paperclip
                            className="size-3.5 shrink-0 text-[var(--fg-4)]"
                            strokeWidth={1.75}
                            aria-label="Pièce jointe"
                          />
                        ) : null}
                        <span className="ml-auto shrink-0 font-mono text-[11px] text-[var(--fg-4)]">
                          {m.receivedAt ? formatDateTime(m.receivedAt) : ""}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-[var(--fg-1)]">
                        {m.subject}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-[var(--fg-3)]">
                        {m.preview}
                      </span>
                      <LinkBadges message={m} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Lecture */}
        <MessagePane
          message={selected}
          onLinked={(client) => {
            // Mise à jour locale : recharger toute la boîte pour un badge
            // serait disproportionné.
            const patch = (m: MailboxMessage): MailboxMessage =>
              m.id === selected?.id
                ? { ...m, linkedClient: client, knownSender: client ? null : m.knownSender }
                : m;
            setSelected((cur) => (cur ? patch(cur) : cur));
            setState((cur) =>
              cur.kind === "ready"
                ? { ...cur, messages: cur.messages.map(patch) }
                : cur,
            );
          }}
        />
      </div>
    </div>
  );
}

/** Rattachement au portefeuille : classé, expéditeur connu, ou rien. */
function LinkBadges({ message }: { message: MailboxMessage }) {
  if (message.linkedClient) {
    return (
      <Link
        href={`/courtier/clients/${message.linkedClient.id}`}
        onClick={(e) => e.stopPropagation()}
        className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-[1px] text-[11px] font-medium transition-opacity hover:opacity-80"
        style={{
          background: "var(--accent-soft)",
          color: "var(--accent-foreground)",
          border: "1px solid rgba(184,146,42,0.2)",
        }}
      >
        <FolderOpen className="size-3" strokeWidth={1.75} />
        {message.linkedClient.name}
      </Link>
    );
  }
  if (message.knownSender) {
    return (
      <span
        className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-[1px] text-[11px]"
        style={{
          background: "var(--bg-sunken)",
          color: "var(--fg-3)",
          border: "1px solid var(--border-1)",
        }}
        title="L’expéditeur a un dossier, mais cet email n’y est pas rattaché."
      >
        <UserRound className="size-3" strokeWidth={1.75} />
        {message.knownSender.name}
      </span>
    );
  }
  return null;
}

/** Panneau de lecture : corps complet et pièces jointes, chargés à la demande. */
function MessagePane({
  message,
  onLinked,
}: {
  message: MailboxMessage | null;
  onLinked: (client: { id: string; name: string } | null) => void;
}) {
  const [detail, setDetail] = React.useState<MailboxMessageDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [loadingImages, setLoadingImages] = React.useState(false);

  const loadDetail = React.useCallback(
    async (withImages: boolean) => {
      if (!message) return;
      if (withImages) setLoadingImages(true);
      else setLoading(true);

      const res = await fetch(
        `/api/courtier/mailbox/message?id=${encodeURIComponent(message.id)}${
          withImages ? "&images=1" : ""
        }`,
      ).catch(() => null);
      const data = (await res?.json().catch(() => null)) as
        | (MailboxMessageDetail & { message?: string })
        | null;

      setLoading(false);
      setLoadingImages(false);
      if (!res?.ok || !data) {
        toast.error("Email illisible.", {
          description: data?.message ?? "Réessayez dans un instant.",
        });
        return;
      }
      setDetail(data);
    },
    [message],
  );

  React.useEffect(() => {
    if (!message) {
      setDetail(null);
      return;
    }
    setDetail(null);
    void loadDetail(false);
  }, [message, loadDetail]);

  if (!message) {
    return (
      <div
        className="hidden items-center justify-center rounded-xl border bg-[var(--bg-surface)] p-10 lg:flex"
        style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="text-center">
          <Mail
            className="mx-auto size-8 text-[var(--fg-4)]"
            strokeWidth={1.25}
          />
          <p className="mt-3 text-[13px] text-[var(--fg-3)]">
            Sélectionnez un email pour le lire en entier.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="flex max-h-[70vh] flex-col overflow-hidden rounded-xl border bg-[var(--bg-surface)]"
        style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
      >
        <div
          className="border-b px-5 py-4"
          style={{ borderColor: "var(--border-1)" }}
        >
          <h2 className="text-[15px] font-semibold leading-snug text-[var(--fg-1)]">
            {message.subject}
          </h2>
          <p className="mt-1 text-[12.5px] text-[var(--fg-3)]">
            {message.from}
            {message.fromEmail ? ` · ${message.fromEmail}` : ""}
          </p>
          <p className="mt-0.5 font-mono text-[11.5px] text-[var(--fg-4)]">
            {message.receivedAt ? formatDateTime(message.receivedAt) : ""}
          </p>
          <div className="mt-3">
            <LinkEmailButton message={message} onLinked={onLinked} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="flex items-center gap-2 text-[13px] text-[var(--fg-3)]">
              <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
              Chargement du message…
            </p>
          ) : detail ? (
            <>
              <EmailBody
                detail={detail}
                onShowImages={() => void loadDetail(true)}
                loadingImages={loadingImages}
              />
              {detail.attachments.length > 0 ? (
                <div
                  className="mt-5 border-t pt-4"
                  style={{ borderColor: "var(--border-1)" }}
                >
                  <p className="fd-eyebrow mb-2">
                    {detail.attachments.length} pièce
                    {detail.attachments.length > 1 ? "s" : ""} jointe
                    {detail.attachments.length > 1 ? "s" : ""}
                  </p>
                  <ul className="space-y-1.5">
                    {detail.attachments.map((a) => (
                      <li key={a.id}>
                        <a
                          href={`/api/courtier/mailbox/attachment?id=${encodeURIComponent(message.id)}&attachment=${encodeURIComponent(a.id)}`}
                          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] transition-colors hover:bg-[var(--bg-sunken)]"
                          style={{ borderColor: "var(--border-1)" }}
                        >
                          <Paperclip
                            className="size-3.5 shrink-0 text-[var(--fg-4)]"
                            strokeWidth={1.75}
                          />
                          <span className="min-w-0 flex-1 truncate text-[var(--fg-1)]">
                            {a.name}
                          </span>
                          <span className="shrink-0 text-[11px] text-[var(--fg-4)]">
                            {formatSize(a.size)}
                          </span>
                          <Download
                            className="size-3.5 shrink-0 text-[var(--fg-4)]"
                            strokeWidth={1.75}
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-[13px] text-[var(--fg-3)]">
              Ce message n’a pas pu être chargé.
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Guidance({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <Inbox className="mx-auto size-7 text-[var(--fg-4)]" strokeWidth={1.25} />
      <p className="mt-3 text-[14px] font-semibold text-[var(--fg-1)]">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-6 text-[var(--fg-3)]">
        {hint}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
