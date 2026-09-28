"use client";

import Link from "next/link";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  CornerUpRight,
  Download,
  FolderInput,
  FolderOpen,
  Inbox,
  Loader2,
  Mail,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  UserRound,
} from "lucide-react";
import { BrokerAvatar } from "@/components/broker/broker-avatar";
import { DeleteEmailButton } from "@/components/broker/delete-email-button";
import { EmailBody } from "@/components/broker/email-body";
import {
  LinkEmailButton,
  linkMailboxEmail,
} from "@/components/broker/link-email-button";
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

type Folder = "received" | "sent";
type Dossier = { id: string; name: string };

const WINDOWS = [7, 14, 30, 90] as const;

/** Type privé du glisser-déposer : un email de la boîte vers un dossier. */
const DRAG_TYPE = "application/x-falcondraft-email";

/** Le correspondant affiché : l'expéditeur d'un reçu, le destinataire d'un envoi. */
function correspondent(m: MailboxMessage): string {
  return m.direction === "sent" ? (m.to[0] ?? "Destinataire") : m.from;
}

/**
 * La boîte email, telle quelle.
 *
 * Complément du briefing : celui-ci ne montre que ce qui appelle une action,
 * celle-ci montre TOUT, y compris ce qui a été écarté. Lecture IMAP seule —
 * consulter son courrier ne déclenche aucune analyse et ne coûte donc rien.
 *
 * Deux onglets — reçus et envoyés — et un rangement au geste : un email glissé
 * sur un dossier y est rattaché, qu'il vienne du client ou du cabinet.
 */
export function MailboxView() {
  const [folder, setFolder] = React.useState<Folder>("received");
  const [state, setState] = React.useState<ListState>({ kind: "loading" });
  const [query, setQuery] = React.useState("");
  const [days, setDays] = React.useState<number>(14);
  const [selected, setSelected] = React.useState<MailboxMessage | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [dragging, setDragging] = React.useState<MailboxMessage | null>(null);
  const [dossiers, setDossiers] = React.useState<Dossier[]>([]);

  const load = React.useCallback(
    async (opts: { days: number; folder: Folder; silent?: boolean }) => {
      if (!opts.silent) setState({ kind: "loading" });
      const res = await fetch(
        `/api/courtier/mailbox?days=${opts.days}&limit=200${opts.folder === "sent" ? "&folder=sent" : ""}`,
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
    setSelected(null);
    void load({ days, folder });
  }, [days, folder, load]);

  // Les dossiers, cibles du glisser-déposer : chargés une fois, en fond.
  React.useEffect(() => {
    void (async () => {
      const res = await fetch("/api/broker/clients?limit=2000").catch(() => null);
      const data = (await res?.json().catch(() => null)) as
        | { clients?: Dossier[] }
        | null;
      if (data?.clients) {
        setDossiers(
          [...data.clients].sort((a, b) => a.name.localeCompare(b.name, "fr")),
        );
      }
    })();
  }, []);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    await load({ days, folder, silent: true });
    setRefreshing(false);
  }

  /** Reflète un rattachement dans la liste et le panneau de lecture. */
  const applyLink = React.useCallback(
    (messageId: string, client: Dossier | null) => {
      const patch = (m: MailboxMessage): MailboxMessage =>
        m.id === messageId
          ? { ...m, linkedClient: client, knownSender: client ? null : m.knownSender }
          : m;
      setSelected((cur) => (cur ? patch(cur) : cur));
      setState((cur) =>
        cur.kind === "ready" ? { ...cur, messages: cur.messages.map(patch) } : cur,
      );
    },
    [],
  );

  const visible = React.useMemo(() => {
    if (state.kind !== "ready") return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return state.messages;
    return state.messages.filter((m) =>
      [m.subject, m.from, m.fromEmail, m.preview, ...m.to].some((f) =>
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
      {/* Reçus / Envoyés */}
      <div
        className="flex items-center gap-1 border-b"
        style={{ borderColor: "var(--border-1)" }}
        role="tablist"
      >
        {(
          [
            { key: "received", label: "Reçus", icon: Inbox },
            { key: "sent", label: "Envoyés", icon: Send },
          ] as const
        ).map((tab) => {
          const active = folder === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFolder(tab.key)}
              className="-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] transition-colors duration-150"
              style={{
                borderColor: active ? "var(--accent)" : "transparent",
                color: active ? "var(--fg-1)" : "var(--fg-3)",
                fontWeight: active ? 600 : 500,
              }}
            >
              <Icon className="size-3.5" strokeWidth={1.75} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 basis-full sm:basis-auto">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--fg-4)]"
            strokeWidth={1.75}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              folder === "sent"
                ? "Rechercher dans vos envois…"
                : "Rechercher dans vos emails…"
            }
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
          {folder === "sent" ? " envoyé" + (visible.length > 1 ? "s" : "") : ""}
          {state.mailbox ? ` · ${state.mailbox}` : ""}
          {linkedCount > 0
            ? ` · ${linkedCount} rattaché${linkedCount > 1 ? "s" : ""} à un dossier`
            : ""}
          {visible.length > 0 ? (
            <span className="hidden lg:inline">
              {" "}· Glissez un email sur un dossier pour l’y ranger.
            </span>
          ) : null}
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
                  : folder === "sent"
                    ? `Rien envoyé sur les ${days} derniers jours.`
                    : `Rien reçu sur les ${days} derniers jours.`
              }
            />
          ) : (
            <ul className="max-h-[70vh] divide-y overflow-y-auto" style={{ borderColor: "var(--border-1)" }}>
              {visible.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "copy";
                      e.dataTransfer.setData(DRAG_TYPE, m.id);
                      // Certains navigateurs ne lancent pas le glisser sans texte.
                      e.dataTransfer.setData("text/plain", m.subject);
                      setDragging(m);
                    }}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => setSelected(m)}
                    className={cn(
                      "flex w-full cursor-grab items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[var(--bg-sunken)] active:cursor-grabbing",
                      selected?.id === m.id && "bg-[var(--bg-sunken)]",
                      dragging?.id === m.id && "opacity-60",
                    )}
                  >
                    <BrokerAvatar name={correspondent(m)} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        {m.direction === "sent" ? (
                          <CornerUpRight
                            className="size-3.5 shrink-0 text-[var(--fg-4)]"
                            strokeWidth={1.75}
                            aria-label="Email envoyé"
                          />
                        ) : null}
                        <span className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                          {m.direction === "sent" ? `À ${correspondent(m)}` : m.from}
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

        {/* Lecture — recouverte par les dossiers pendant un glisser-déposer */}
        <div className="relative min-h-0">
          <MessagePane
            message={selected}
            onDeleted={(messageId) => {
              // Retrait local : le message n'est plus dans la boîte, recharger
              // toute la fenêtre pour le constater serait du gâchis.
              setSelected(null);
              setState((cur) =>
                cur.kind === "ready"
                  ? {
                      ...cur,
                      messages: cur.messages.filter((m) => m.id !== messageId),
                    }
                  : cur,
              );
            }}
            onLinked={(client) => {
              if (selected) applyLink(selected.id, client);
            }}
          />
          <AnimatePresence>
            {dragging ? (
              <DossierDropPanel
                key="drop"
                message={dragging}
                dossiers={dossiers}
                onDropOn={async (dossier) => {
                  const message = dragging;
                  setDragging(null);
                  const linked = await linkMailboxEmail(message, dossier.id);
                  if (linked.ok) applyLink(message.id, linked.client);
                }}
              />
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/**
 * Les dossiers, en cibles de dépôt. Pendant un glisser on ne peut pas taper :
 * le dossier du correspondant vient donc en tête, puis tous les dossiers par
 * ordre alphabétique (la liste défile d'elle-même quand on approche du bord).
 */
function DossierDropPanel({
  message,
  dossiers,
  onDropOn,
}: {
  message: MailboxMessage;
  dossiers: Dossier[];
  onDropOn: (dossier: Dossier) => void;
}) {
  const [over, setOver] = React.useState<string | null>(null);
  const suggested = message.knownSender ?? message.linkedClient ?? null;
  const rest = suggested ? dossiers.filter((d) => d.id !== suggested.id) : dossiers;

  function target(dossier: Dossier, highlight?: boolean) {
    const active = over === dossier.id;
    return (
      <li key={dossier.id}>
        <div
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            if (over !== dossier.id) setOver(dossier.id);
          }}
          onDragLeave={() => setOver((cur) => (cur === dossier.id ? null : cur))}
          onDrop={(e) => {
            e.preventDefault();
            onDropOn(dossier);
          }}
          className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] transition-colors duration-100"
          style={{
            borderColor: active
              ? "var(--accent)"
              : highlight
                ? "rgba(184,146,42,0.35)"
                : "var(--border-1)",
            background: active
              ? "var(--accent-soft)"
              : highlight
                ? "var(--accent-soft)"
                : "var(--bg-surface)",
            color: "var(--fg-1)",
          }}
        >
          <FolderOpen
            className="size-4 shrink-0"
            strokeWidth={1.75}
            style={{ color: active || highlight ? "var(--accent-foreground)" : "var(--fg-3)" }}
          />
          <span className="truncate font-medium">{dossier.name}</span>
          {message.linkedClient?.id === dossier.id ? (
            <span className="ml-auto shrink-0 text-[11px] text-[var(--fg-3)]">
              déjà rangé ici
            </span>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="absolute inset-0 z-10 flex flex-col overflow-hidden rounded-xl border bg-[var(--bg-surface)]"
      style={{ borderColor: "var(--accent)", boxShadow: "var(--shadow-lg)" }}
    >
      <div className="border-b px-4 py-3" style={{ borderColor: "var(--border-1)" }}>
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--fg-1)]">
          <FolderInput className="size-4 text-[var(--accent-foreground)]" strokeWidth={1.75} />
          Ranger dans un dossier
        </p>
        <p className="mt-0.5 truncate text-[12px] text-[var(--fg-3)]">
          Lâchez « {message.subject} » sur le dossier du client.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {suggested ? (
          <>
            <p className="fd-eyebrow mb-1.5 px-1">
              {message.direction === "sent" ? "Destinataire" : "Expéditeur"}
            </p>
            <ul className="mb-4">{target(suggested, true)}</ul>
          </>
        ) : null}
        <p className="fd-eyebrow mb-1.5 px-1">Tous les dossiers</p>
        {rest.length > 0 ? (
          <ul className="space-y-1.5">{rest.map((d) => target(d))}</ul>
        ) : (
          <p className="px-1 text-[12.5px] text-[var(--fg-3)]">
            Chargement des dossiers…
          </p>
        )}
      </div>
    </motion.div>
  );
}

/** Rattachement au portefeuille : classé, correspondant connu, ou rien. */
function LinkBadges({ message }: { message: MailboxMessage }) {
  if (message.linkedClient) {
    return (
      <Link
        href={`/courtier/clients/${message.linkedClient.id}`}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
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
        title={
          message.direction === "sent"
            ? "Le destinataire a un dossier, mais cet email n’y est pas rattaché."
            : "L’expéditeur a un dossier, mais cet email n’y est pas rattaché."
        }
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
  onDeleted,
}: {
  message: MailboxMessage | null;
  onLinked: (client: { id: string; name: string } | null) => void;
  onDeleted: (messageId: string) => void;
}) {
  const [detail, setDetail] = React.useState<MailboxMessageDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadDetail = React.useCallback(
    async () => {
      if (!message) return;
      setLoading(true);

      const res = await fetch(
        `/api/courtier/mailbox/message?id=${encodeURIComponent(message.id)}`,
      ).catch(() => null);
      const data = (await res?.json().catch(() => null)) as
        | (MailboxMessageDetail & { message?: string })
        | null;

      setLoading(false);
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
    void loadDetail();
  }, [message, loadDetail]);

  if (!message) {
    return (
      <div
        className="hidden h-full items-center justify-center rounded-xl border bg-[var(--bg-surface)] p-10 lg:flex"
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
          <p className="mt-1 text-[12px] text-[var(--fg-4)]">
            Ou faites-le glisser sur un dossier pour l’y ranger.
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
            {message.direction === "sent"
              ? `À ${message.to.join(", ") || "destinataire inconnu"}`
              : `${message.from}${message.fromEmail ? ` · ${message.fromEmail}` : ""}`}
          </p>
          <p className="mt-0.5 font-mono text-[11.5px] text-[var(--fg-4)]">
            {message.receivedAt ? formatDateTime(message.receivedAt) : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <LinkEmailButton message={message} onLinked={onLinked} />
            <DeleteEmailButton
              messageId={message.id}
              subject={message.subject}
              onDeleted={() => onDeleted(message.id)}
            />
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
              <EmailBody detail={detail} />
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
