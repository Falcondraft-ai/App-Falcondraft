"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  Check,
  ChevronDown,
  Eye,
  ExternalLink,
  EyeOff,
  FileSignature,
  HelpCircle,
  Mail,
  MailOpen,
  MessageSquare,
  Paperclip,
  PenLine,
  Receipt,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  StickyNote,
  UserCog,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  EmailReaderDialog,
  type EmailReaderTarget,
} from "@/components/broker/email-reader-dialog";
import {
  emailCategoryLabel,
  emailCategoryOrder,
  findClientIdByName,
  mailboxAddressColor,
  suggestionAcceptLabels,
  suggestionRank,
  suggestionTypeLabels,
  type EmailCategory,
  type SuggestionType,
} from "@/lib/broker/outlook";
import { AttachmentPreview } from "@/components/broker/attachment-preview";
import { BrokerAvatar } from "@/components/broker/broker-avatar";
import {
  ClientPicker,
  type ClientOption,
} from "@/components/broker/client-picker";
import { DigestBackfillMenu } from "@/components/broker/digest-backfill-menu";
import { brokerDocumentCategoryLabels } from "@/lib/broker/documents";
import { GenerateDigestButton } from "@/components/broker/generate-digest-button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  BrokerEmailDigestRow,
  BrokerEmailItemRow,
  BrokerEmailSuggestionRow,
} from "@/types/database";

type LocalStatus = "pending" | "loading" | "done" | "rejected" | "failed";

const categoryIcons: Record<EmailCategory, React.ReactNode> = {
  claim: <ShieldAlert className="size-4" strokeWidth={1.75} />,
  renewal: <CalendarClock className="size-4" strokeWidth={1.75} />,
  client_request: <MessageSquare className="size-4" strokeWidth={1.75} />,
  prospect: <UserPlus className="size-4" strokeWidth={1.75} />,
  quote: <ScrollText className="size-4" strokeWidth={1.75} />,
  contract: <FileSignature className="size-4" strokeWidth={1.75} />,
  invoice: <Receipt className="size-4" strokeWidth={1.75} />,
  other_broker: <Mail className="size-4" strokeWidth={1.75} />,
};

const suggestionIcons: Record<SuggestionType, React.ReactNode> = {
  attach_document: <Paperclip className="size-3.5" strokeWidth={1.75} />,
  draft_reply: <PenLine className="size-3.5" strokeWidth={1.75} />,
  create_client: <UserPlus className="size-3.5" strokeWidth={1.75} />,
  update_client: <UserCog className="size-3.5" strokeWidth={1.75} />,
  declare_claim: <ShieldAlert className="size-3.5" strokeWidth={1.75} />,
  flag_renewal: <CalendarClock className="size-3.5" strokeWidth={1.75} />,
  add_note: <StickyNote className="size-3.5" strokeWidth={1.75} />,
};

function pstr(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function suggestionDescription(
  suggestion: BrokerEmailSuggestionRow,
  clientName: string | null,
): string {
  const p = suggestion.payload ?? {};
  switch (suggestion.type) {
    case "attach_document":
      // The target dossier is shown by the picker on the row itself, so the
      // sentence stays about the document.
      return `Ranger « ${pstr(p, "file_name") ?? "pièce jointe"} »`;
    case "draft_reply":
      return pstr(p, "subject")
        ? `Brouillon de réponse — « ${pstr(p, "subject")} »`
        : "Préparer un brouillon de réponse";
    case "create_client": {
      const name =
        pstr(p, "company_name") ||
        [pstr(p, "first_name"), pstr(p, "last_name")]
          .filter(Boolean)
          .join(" ") ||
        pstr(p, "email") ||
        "ce prospect";
      return `Créer le dossier client pour ${name}`;
    }
    case "declare_claim":
      return pstr(p, "claim_type")
        ? `Pré-remplir un sinistre — ${pstr(p, "claim_type")}`
        : "Pré-remplir une déclaration de sinistre";
    case "flag_renewal":
      return pstr(p, "note") ?? "Signaler l’échéance mentionnée";
    case "add_note": {
      const note = pstr(p, "note");
      const who = clientName ? `au dossier ${clientName}` : "au dossier";
      return note ? `Noter ${who} : « ${note} »` : `Ajouter une note ${who}`;
    }
    default:
      return suggestionTypeLabels[suggestion.type as SuggestionType] ?? "Action";
  }
}

function StatChip({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="rounded-lg border px-3.5 py-2"
      style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}
    >
      <p className="text-[18px] font-semibold leading-none tracking-[-0.01em] text-[var(--fg-1)]">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[var(--fg-3)]">{label}</p>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  clientName,
  clientId,
  clientOptions,
  onPickClient,
  onClientsOpen,
  onPreview,
  status,
  onAccept,
  onReject,
}: {
  suggestion: BrokerEmailSuggestionRow;
  clientName: string | null;
  clientId: string | null;
  clientOptions: ClientOption[];
  onPickClient: (clientId: string) => void;
  onClientsOpen: () => void;
  onPreview?: () => void;
  status: LocalStatus;
  onAccept: () => void;
  onReject: () => void;
}) {
  const type = suggestion.type as SuggestionType;
  const resolved = status === "done" || status === "rejected";
  // Where the attachment gets filed is decided on the row itself: pre-selected
  // from what the AI matched (or read inside the document), always changeable.
  const isAttachment = type === "attach_document";
  const detectedLabel = pstr(suggestion.payload ?? {}, "detected_label");
  const missingClient = isAttachment && !clientId;
  // Say where the file actually lands — a devis becomes a « Devis compagnie »
  // in the dossier, not just a file in the GED.
  const documentCategory = isAttachment
    ? pstr(suggestion.payload ?? {}, "document_category")
    : null;
  const categoryLabel = documentCategory
    ? brokerDocumentCategoryLabels[
        documentCategory as keyof typeof brokerDocumentCategoryLabels
      ]
    : null;

  return (
    <div
      className="flex items-center gap-3 rounded-md border px-3 py-2.5"
      style={{
        borderColor: "var(--border-1)",
        background:
          status === "done"
            ? "var(--success-soft, #f0fdf4)"
            : status === "rejected"
              ? "var(--bg-sunken)"
              : "var(--bg-surface)",
      }}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md"
        style={{
          background: "var(--brand-navy-50)",
          color: "var(--brand-navy-700)",
          border: "1px solid var(--border-1)",
        }}
      >
        {suggestionIcons[type] ?? <Mail className="size-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[12.5px]",
            status === "rejected"
              ? "text-[var(--fg-4)] line-through"
              : "text-[var(--fg-2)]",
          )}
        >
          {suggestionDescription(suggestion, clientName)}
        </p>
        {isAttachment && (detectedLabel || categoryLabel) ? (
          <p className="mt-0.5 truncate text-[11.5px] text-[var(--fg-4)]">
            {[categoryLabel, detectedLabel].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {isAttachment && !resolved ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ClientPicker
              clients={clientOptions}
              value={clientId}
              placeholder="Choisir un dossier"
              tone="attention"
              onPick={onPickClient}
              onOpen={onClientsOpen}
            />
            {onPreview ? (
              <button
                type="button"
                onClick={onPreview}
                className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-2)]"
                style={{ color: "var(--fg-4)" }}
              >
                <Eye className="size-3.5" strokeWidth={1.75} />
                Aperçu
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {resolved ? (
          <motion.span
            key="resolved"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold"
            style={{
              color:
                status === "done"
                  ? "var(--success, #15803d)"
                  : "var(--fg-4)",
            }}
          >
            {status === "done" ? (
              <>
                <Check className="size-3.5" strokeWidth={2.5} /> Fait
              </>
            ) : (
              "Ignoré"
            )}
          </motion.span>
        ) : (
          <motion.div
            key="actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex shrink-0 items-center gap-1.5"
          >
            <button
              type="button"
              onClick={onReject}
              disabled={status === "loading"}
              aria-label="Ignorer"
              className="inline-flex size-7 items-center justify-center rounded-md border transition-colors hover:bg-[var(--bg-sunken)] disabled:opacity-50"
              style={{ borderColor: "var(--border-1)", color: "var(--fg-3)" }}
            >
              <X className="size-3.5" strokeWidth={2} />
            </button>
            <Button
              type="button"
              size="sm"
              onClick={onAccept}
              disabled={status === "loading" || missingClient}
              title={
                missingClient
                  ? "Choisissez le dossier où ranger cette pièce jointe."
                  : undefined
              }
              className="h-7 gap-1 px-2.5 text-[12px]"
            >
              {status === "loading" ? (
                "…"
              ) : (
                <>
                  <Check className="size-3.5" strokeWidth={2.25} />
                  {suggestionAcceptLabels[type] ?? "Valider"}
                </>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Colored pastille for the mailbox address an email was delivered to. */
function MailboxBadge({ address }: { address: string }) {
  const c = mailboxAddressColor(address);
  return (
    <span
      className="inline-flex max-w-[180px] shrink-0 items-center gap-1.5 rounded-full border px-2 py-[1px] text-[10.5px] font-medium"
      style={{ background: c.soft, color: c.fg, borderColor: c.border }}
      title={`Reçu sur ${address}`}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: c.dot }}
        aria-hidden
      />
      <span className="truncate">{address}</span>
    </span>
  );
}

function ItemCard({
  item,
  onRead,
  suggestions,
  clientName,
  clientIdFor,
  onPickSuggestionClient,
  onClientsOpen,
  statuses,
  onAccept,
  onReject,
  onExclude,
  excludeBusy,
  topBar,
  showMailbox,
  attachClients,
  onAttachClient,
  attachBusy,
}: {
  /** Ouvre l'email en entier dans l'outil. */
  onRead: () => void;
  item: BrokerEmailItemRow;
  suggestions: BrokerEmailSuggestionRow[];
  clientName: string | null;
  clientIdFor: (s: BrokerEmailSuggestionRow) => string | null;
  onPickSuggestionClient: (
    s: BrokerEmailSuggestionRow,
    clientId: string,
  ) => void;
  onClientsOpen: () => void;
  statuses: Record<string, LocalStatus>;
  onAccept: (s: BrokerEmailSuggestionRow) => void;
  onReject: (s: BrokerEmailSuggestionRow) => void;
  onExclude?: () => void;
  excludeBusy?: boolean;
  topBar?: React.ReactNode;
  showMailbox?: boolean;
  attachClients?: ClientOption[];
  onAttachClient?: (clientId: string) => void;
  attachBusy?: boolean;
}) {
  // A pending « créer le dossier » makes the manual link redundant: accepting
  // it creates the dossier and links the email and its sibling actions to it.
  const creatingClient = suggestions.some(
    (s) =>
      s.type === "create_client" && (statuses[s.id] ?? "pending") === "pending",
  );

  // Attachments of this email, previewable side by side with the email itself.
  const attachments = React.useMemo(
    () => suggestions.filter((s) => s.type === "attach_document"),
    [suggestions],
  );
  const [previewIndex, setPreviewIndex] = React.useState<number | null>(null);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-lg border bg-[var(--bg-surface)] p-4 transition-shadow hover:shadow-[var(--shadow-md)]"
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      {topBar}
      <div className="flex items-start gap-3">
        <BrokerAvatar
          name={item.from_name || item.from_email || "Expéditeur"}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
              {item.from_name || item.from_email || "Expéditeur"}
            </p>
            {item.urgency === "high" ? (
              <span
                className="shrink-0 rounded-full border px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-[0.04em]"
                style={{
                  color: "var(--destructive)",
                  background: "var(--destructive-soft, rgba(185,28,28,0.08))",
                  borderColor: "rgba(185,28,28,0.2)",
                }}
              >
                Urgent
              </span>
            ) : null}
            {clientName ? (
              <span
                className="hidden shrink-0 rounded-full border px-2 py-[1px] text-[10.5px] font-medium sm:inline"
                style={{
                  color: "var(--brand-navy-700)",
                  background: "var(--brand-navy-50)",
                  borderColor: "var(--border-1)",
                }}
              >
                {clientName}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-[var(--fg-1)]">
            {item.subject}
          </p>
          {item.summary ? (
            <p className="mt-1 text-[12.5px] leading-5 text-[var(--fg-3)]">
              {item.summary}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="font-mono text-[11px] text-[var(--fg-4)]">
              {item.received_at ? formatDateTime(item.received_at) : ""}
            </p>
            {showMailbox && item.mailbox_address ? (
              <MailboxBadge address={item.mailbox_address} />
            ) : null}
          </div>
        </div>
        {item.web_link ? (
          <a
            href={item.web_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors hover:bg-[var(--bg-sunken)]"
            style={{ borderColor: "var(--border-1)", color: "var(--fg-3)" }}
            aria-label="Ouvrir dans Outlook"
            title="Ouvrir dans Outlook"
          >
            <ExternalLink className="size-3.5" strokeWidth={1.75} />
          </a>
        ) : null}
      </div>

      {suggestions.length > 0 ? (
        <div className="mt-3 space-y-2">
          {suggestions.map((s) => (
            <SuggestionRow
              key={s.id}
              suggestion={s}
              clientName={clientName}
              clientId={clientIdFor(s)}
              clientOptions={attachClients ?? []}
              onPickClient={(clientId) => onPickSuggestionClient(s, clientId)}
              onClientsOpen={onClientsOpen}
              onPreview={
                s.type === "attach_document"
                  ? () =>
                      setPreviewIndex(
                        Math.max(
                          0,
                          attachments.findIndex((a) => a.id === s.id),
                        ),
                      )
                  : undefined
              }
              status={statuses[s.id] ?? "pending"}
              onAccept={() => onAccept(s)}
              onReject={() => onReject(s)}
            />
          ))}
        </div>
      ) : null}

      {!clientName && onAttachClient && attachClients ? (
        creatingClient ? (
          // The dossier is about to be created by the action above — linking
          // the email by hand is pointless here. Kept only as a discreet way
          // out when the contact turns out to already have a dossier.
          <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1">
            <p className="text-[11.5px] text-[var(--fg-4)]">
              Ce contact a déjà un dossier ?
            </p>
            <ClientPicker
              clients={attachClients}
              busy={Boolean(attachBusy)}
              placeholder="Le rattacher"
              subtle
              onPick={onAttachClient}
              onOpen={onClientsOpen}
            />
          </div>
        ) : (
          <div
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2"
            style={{
              borderColor: "var(--border-1)",
              background: "var(--bg-sunken)",
            }}
          >
            <p className="text-[12px] text-[var(--fg-3)]">
              Pas encore rattaché à un dossier.
            </p>
            <ClientPicker
              clients={attachClients}
              busy={Boolean(attachBusy)}
              placeholder="Rattacher à un dossier"
              onPick={onAttachClient}
              onOpen={onClientsOpen}
            />
          </div>
        )
      ) : null}

      {onExclude ? (
        <div
          className="mt-3 flex items-center justify-end gap-1.5 border-t pt-2.5"
          style={{ borderColor: "var(--border-1)" }}
        >
          {/* Lecture dans l'outil : seule option hors Microsoft, où l'email
              n'a aucune URL. Toujours proposée — un résumé ne suffit pas pour
              trancher sur un sinistre ou une échéance. */}
          <button
            type="button"
            onClick={onRead}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-1)]"
          >
            <MailOpen className="size-3.5" strokeWidth={1.75} />
            Lire l’email
          </button>
          {item.web_link ? (
            <a
              href={item.web_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-1)]"
            >
              <ExternalLink className="size-3.5" strokeWidth={1.75} />
              Ouvrir dans Outlook
            </a>
          ) : null}
          <button
            type="button"
            onClick={onExclude}
            disabled={excludeBusy}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-sunken)] disabled:opacity-50"
            style={{ borderColor: "var(--border-1)" }}
          >
            <EyeOff className="size-3.5" strokeWidth={1.75} />
            Écarter
          </button>
        </div>
      ) : null}

      {previewIndex !== null && attachments.length > 0 ? (
        <AttachmentPreview
          open
          onOpenChange={(next) => {
            if (!next) setPreviewIndex(null);
          }}
          item={item}
          attachments={attachments}
          index={Math.min(previewIndex, attachments.length - 1)}
          onIndexChange={setPreviewIndex}
          statuses={statuses}
          clientOptions={attachClients ?? []}
          clientIdFor={clientIdFor}
          onPickClient={onPickSuggestionClient}
          onClientsOpen={onClientsOpen}
          onAccept={onAccept}
        />
      ) : null}
    </motion.article>
  );
}

export function OutlookDigest({
  digest,
  items,
  suggestions,
  clientNames,
}: {
  digest: BrokerEmailDigestRow;
  items: BrokerEmailItemRow[];
  suggestions: BrokerEmailSuggestionRow[];
  clientNames: Record<string, string>;
}) {
  // Email ouvert en lecture. Un seul à la fois : c'est une consultation, pas
  // une navigation.
  const [reading, setReading] = React.useState<EmailReaderTarget | null>(null);
  const openReader = React.useCallback((item: BrokerEmailItemRow) => {
    setReading({
      id: item.graph_message_id,
      subject: item.subject || "(sans objet)",
      from: item.from_name || item.from_email || "Expéditeur",
      fromEmail: item.from_email,
      receivedAt: item.received_at,
    });
  }, []);

  const initialStatuses = React.useMemo(() => {
    const map: Record<string, LocalStatus> = {};
    for (const s of suggestions) {
      map[s.id] =
        s.status === "done"
          ? "done"
          : s.status === "rejected"
            ? "rejected"
            : s.status === "failed"
              ? "failed"
              : "pending";
    }
    return map;
  }, [suggestions]);

  const [statuses, setStatuses] =
    React.useState<Record<string, LocalStatus>>(initialStatuses);

  const [itemRelevance, setItemRelevance] = React.useState<
    Record<string, string>
  >(() => Object.fromEntries(items.map((i) => [i.id, i.relevance])));
  const [itemBusy, setItemBusy] = React.useState<Record<string, boolean>>({});
  const [showExcluded, setShowExcluded] = React.useState(false);

  // Locally-attached client per item (feature: rattacher un email à un dossier).
  const [attachedClient, setAttachedClient] = React.useState<
    Record<string, string>
  >({});
  const [attachBusy, setAttachBusy] = React.useState<Record<string, boolean>>(
    {},
  );

  // Dossier picked by the broker on a given action (overrides the AI guess).
  const [pickedClient, setPickedClient] = React.useState<Record<string, string>>(
    {},
  );

  // Address filter (multi-adresse).
  const [addressFilter, setAddressFilter] = React.useState<string | null>(null);

  // Live dossier directory: seeded from the server, then kept up to date
  // in place — a dossier created from the briefing (or elsewhere) must show up
  // in the pickers without reloading the page.
  const [clientDirectory, setClientDirectory] =
    React.useState<Record<string, string>>(clientNames);
  React.useEffect(() => {
    setClientDirectory((prev) => ({ ...prev, ...clientNames }));
  }, [clientNames]);

  const lastClientFetch = React.useRef(0);
  const refreshClients = React.useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastClientFetch.current < 5000) return;
    lastClientFetch.current = now;
    const res = await fetch("/api/broker/clients").catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json().catch(() => null)) as {
      clients?: ClientOption[];
    } | null;
    if (!data?.clients?.length) return;
    setClientDirectory((prev) => {
      const next = { ...prev };
      for (const c of data.clients!) next[c.id] = c.name;
      return next;
    });
  }, []);

  const clientOptions = React.useMemo(
    () =>
      Object.entries(clientDirectory)
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [clientDirectory],
  );

  const clientNameFor = React.useCallback(
    (item: BrokerEmailItemRow): string | null => {
      const id = attachedClient[item.id] ?? item.suggested_client_id;
      return id ? (clientDirectory[id] ?? null) : null;
    },
    [attachedClient, clientDirectory],
  );

  /**
   * Dossier an action will run against, most explicit source first:
   * the broker's pick → the email's dossier → the one matched when the digest
   * was generated → the name read inside the document itself.
   */
  const clientIdFor = React.useCallback(
    (item: BrokerEmailItemRow, s: BrokerEmailSuggestionRow): string | null => {
      const payload = s.payload ?? {};
      return (
        pickedClient[s.id] ??
        attachedClient[item.id] ??
        pstr(payload, "client_id") ??
        item.suggested_client_id ??
        (s.type === "attach_document"
          ? findClientIdByName(
              pstr(payload, "detected_subject_name"),
              clientOptions,
            )
          : null)
      );
    },
    [pickedClient, attachedClient, clientOptions],
  );

  // Distinct mailbox addresses present in this digest.
  const mailboxAddresses = React.useMemo(() => {
    const set = new Set<string>();
    for (const i of items) if (i.mailbox_address) set.add(i.mailbox_address);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);
  const showMailbox = mailboxAddresses.length > 1;

  async function attachClient(itemId: string, clientId: string) {
    if (attachBusy[itemId]) return;
    setAttachBusy((m) => ({ ...m, [itemId]: true }));
    try {
      const res = await fetch(`/api/courtier/outlook/items/${itemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attach_client", clientId }),
      }).catch(() => null);
      if (!res?.ok) {
        toast.error("Rattachement impossible.");
        return;
      }
      setAttachedClient((m) => ({ ...m, [itemId]: clientId }));
      toast.success(`Rattaché à ${clientDirectory[clientId] ?? "ce dossier"}.`);
    } finally {
      setAttachBusy((m) => ({ ...m, [itemId]: false }));
    }
  }

  async function resolveItem(itemId: string, action: "keep" | "exclude") {
    if (itemBusy[itemId]) return;
    setItemBusy((m) => ({ ...m, [itemId]: true }));
    try {
      const res = await fetch(`/api/courtier/outlook/items/${itemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }).catch(() => null);
      if (!res?.ok) {
        toast.error("Action impossible.");
        return;
      }
      setItemRelevance((m) => ({
        ...m,
        [itemId]: action === "keep" ? "relevant" : "excluded",
      }));
    } finally {
      setItemBusy((m) => ({ ...m, [itemId]: false }));
    }
  }

  const matchesAddress = (i: BrokerEmailItemRow) =>
    !addressFilter || i.mailbox_address === addressFilter;

  const relevantItems = items.filter(
    (i) =>
      (itemRelevance[i.id] ?? i.relevance) === "relevant" && matchesAddress(i),
  );
  const uncertainItems = items.filter(
    (i) =>
      (itemRelevance[i.id] ?? i.relevance) === "uncertain" && matchesAddress(i),
  );
  const excludedItems = items.filter(
    (i) =>
      (itemRelevance[i.id] ?? i.relevance) === "excluded" && matchesAddress(i),
  );

  const itemById = React.useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items],
  );

  const suggestionsByItem = React.useMemo(() => {
    const map = new Map<string, BrokerEmailSuggestionRow[]>();
    for (const s of suggestions) {
      const list = map.get(s.item_id) ?? [];
      list.push(s);
      map.set(s.item_id, list);
    }
    // « Créer le dossier » first, then the actions that need that dossier.
    for (const list of map.values()) {
      list.sort((a, b) => suggestionRank(a.type) - suggestionRank(b.type));
    }
    return map;
  }, [suggestions]);

  const pendingActions = React.useMemo(
    () =>
      suggestions.filter((s) => (statuses[s.id] ?? "pending") === "pending")
        .length,
    [suggestions, statuses],
  );

  async function resolve(s: BrokerEmailSuggestionRow, action: "accept" | "reject") {
    if ((statuses[s.id] ?? "pending") !== "pending") return;
    setStatuses((m) => ({ ...m, [s.id]: "loading" }));
    try {
      // Run the action against the dossier shown on the row — never a stale one.
      const item = itemById.get(s.item_id);
      const targetClientId =
        action === "accept" && item && s.type !== "create_client"
          ? clientIdFor(item, s)
          : null;

      const res = await fetch(`/api/courtier/outlook/suggestions/${s.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(targetClientId ? { clientId: targetClientId } : {}),
        }),
      }).catch(() => null);
      const result = (await res?.json().catch(() => null)) as
        | {
            success?: boolean;
            message?: string;
            status?: string;
            clientId?: string;
            clientName?: string;
          }
        | null;

      if (!res?.ok || !result?.success) {
        setStatuses((m) => ({ ...m, [s.id]: "pending" }));
        toast.error(
          action === "accept" ? "Action impossible." : "Impossible d’ignorer.",
          { description: result?.message },
        );
        return;
      }
      setStatuses((m) => ({
        ...m,
        [s.id]: action === "accept" ? "done" : "rejected",
      }));

      // A dossier was just created: list it right away and point the email (and
      // its remaining actions) at it — no page reload needed.
      if (action === "accept" && s.type === "create_client" && result.clientId) {
        const newId = result.clientId;
        if (result.clientName) {
          setClientDirectory((m) => ({ ...m, [newId]: result.clientName! }));
        }
        setAttachedClient((m) => ({ ...m, [s.item_id]: newId }));
        void refreshClients(true);
      }
    } catch {
      setStatuses((m) => ({ ...m, [s.id]: "pending" }));
    }
  }

  // Group the RELEVANT items by category in display order.
  const byCat = new Map<string, BrokerEmailItemRow[]>();
  for (const item of relevantItems) {
    const cat = item.category ?? "other_broker";
    const list = byCat.get(cat) ?? [];
    list.push(item);
    byCat.set(cat, list);
  }
  const grouped: { category: string; items: BrokerEmailItemRow[] }[] = [];
  for (const cat of emailCategoryOrder) {
    const list = byCat.get(cat);
    if (list && list.length) grouped.push({ category: cat, items: list });
    byCat.delete(cat);
  }
  for (const [cat, list] of byCat) grouped.push({ category: cat, items: list });

  const narrativeSentences = (digest.narrative ?? "")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Storytelling header */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="overflow-hidden rounded-xl border"
        style={{
          borderColor: "var(--border-1)",
          background:
            "linear-gradient(135deg, var(--brand-navy-50) 0%, var(--bg-surface) 60%)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="fd-eyebrow">Votre briefing du jour</p>
            <div className="flex items-center gap-1.5">
              <DigestBackfillMenu />
              <GenerateDigestButton variant="ghost" />
            </div>
          </div>
          <div className="mt-3 max-w-2xl text-[15px] leading-7 text-[var(--fg-1)] sm:text-[16px]">
            {narrativeSentences.length > 0 ? (
              narrativeSentences.map((sentence, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 + i * 0.35, duration: 0.5 }}
                >
                  {sentence}{" "}
                </motion.span>
              ))
            ) : (
              <span>Briefing prêt.</span>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4"
          >
            <StatChip value={relevantItems.length} label="À traiter" />
            <StatChip value={uncertainItems.length} label="À confirmer" />
            <StatChip value={pendingActions} label="Actions proposées" />
            <StatChip value={excludedItems.length} label="Écartés" />
          </motion.div>
          {digest.generated_at ? (
            <p className="mt-3 text-[11px] text-[var(--fg-4)]">
              Généré le {formatDateTime(digest.generated_at)}
            </p>
          ) : null}
        </div>
      </motion.section>

      {/* Légende / filtre des adresses du cabinet (multi-adresse) */}
      {showMailbox ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5"
          style={{
            borderColor: "var(--border-1)",
            background: "var(--bg-surface)",
          }}
        >
          <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--fg-4)]">
            Adresses
          </span>
          <button
            type="button"
            onClick={() => setAddressFilter(null)}
            className="inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-medium transition-colors"
            style={
              addressFilter === null
                ? {
                    background: "var(--brand-navy-800)",
                    borderColor: "var(--brand-navy-800)",
                    color: "#FFFFFF",
                  }
                : {
                    background: "var(--bg-surface)",
                    borderColor: "var(--border-1)",
                    color: "var(--fg-2)",
                  }
            }
          >
            Toutes
          </button>
          {mailboxAddresses.map((addr) => {
            const c = mailboxAddressColor(addr);
            const active = addressFilter === addr;
            return (
              <button
                key={addr}
                type="button"
                onClick={() => setAddressFilter(active ? null : addr)}
                className="inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors"
                style={{
                  background: active ? c.soft : "var(--bg-surface)",
                  borderColor: active ? c.border : "var(--border-1)",
                  color: active ? c.fg : "var(--fg-2)",
                }}
                title={addr}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: c.dot }}
                  aria-hidden
                />
                <span className="truncate">{addr}</span>
              </button>
            );
          })}
        </motion.div>
      ) : null}

      {/* À confirmer (cas incertains) */}
      <AnimatePresence initial={false}>
        {uncertainItems.length > 0 ? (
          <motion.section
            key="uncertain"
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <span style={{ color: "var(--brand-amber-800, #92610f)" }}>
                <HelpCircle className="size-4" strokeWidth={1.75} />
              </span>
              <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--fg-1)]">
                À confirmer
              </h2>
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                style={{
                  background: "var(--brand-amber-50, #fdf7e8)",
                  color: "var(--brand-amber-800, #92610f)",
                }}
              >
                {uncertainItems.length}
              </span>
              <span className="text-[12px] text-[var(--fg-3)]">
                · cas ambigus — gardez-les ou écartez-les
              </span>
            </div>
            <AnimatePresence initial={false}>
              {uncertainItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onRead={() => openReader(item)}
                  suggestions={suggestionsByItem.get(item.id) ?? []}
                  clientName={clientNameFor(item)}
                  clientIdFor={(s) => clientIdFor(item, s)}
                  onPickSuggestionClient={(s, clientId) =>
                    setPickedClient((m) => ({ ...m, [s.id]: clientId }))
                  }
                  onClientsOpen={() => void refreshClients()}
                  statuses={statuses}
                  onAccept={(s) => resolve(s, "accept")}
                  onReject={(s) => resolve(s, "reject")}
                  showMailbox={showMailbox}
                  attachClients={clientOptions}
                  onAttachClient={(clientId) => attachClient(item.id, clientId)}
                  attachBusy={attachBusy[item.id]}
                  topBar={
                    <div
                      className="mb-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
                      style={{
                        borderColor: "var(--brand-amber-200, rgba(184,146,42,0.25))",
                        background: "var(--brand-amber-50, #fdf7e8)",
                      }}
                    >
                      <HelpCircle
                        className="size-3.5 shrink-0"
                        strokeWidth={1.75}
                        style={{ color: "var(--brand-amber-800, #92610f)" }}
                      />
                      <p
                        className="min-w-0 flex-1 text-[12px]"
                        style={{ color: "var(--brand-amber-800, #92610f)" }}
                      >
                        {item.exclusion_reason ||
                          "Lien avec le courtage incertain."}
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => resolveItem(item.id, "exclude")}
                          disabled={itemBusy[item.id]}
                          className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--bg-sunken)] disabled:opacity-50"
                          style={{
                            borderColor: "var(--border-1)",
                            color: "var(--fg-3)",
                          }}
                        >
                          <EyeOff className="size-3.5" strokeWidth={1.75} />
                          Écarter
                        </button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => resolveItem(item.id, "keep")}
                          disabled={itemBusy[item.id]}
                          className="h-7 gap-1 px-2.5 text-[12px]"
                        >
                          <Check className="size-3.5" strokeWidth={2.25} />
                          Garder
                        </Button>
                      </div>
                    </div>
                  }
                />
              ))}
            </AnimatePresence>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {/* Emails pertinents groupés */}
      {grouped.length > 0 ? (
        <div className="space-y-6">
          {grouped.map((group, gi) => (
            <section key={group.category} className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span style={{ color: "var(--brand-navy-700)" }}>
                  {categoryIcons[group.category as EmailCategory] ?? (
                    <Mail className="size-4" strokeWidth={1.75} />
                  )}
                </span>
                <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--fg-1)]">
                  {emailCategoryLabel(group.category)}
                </h2>
                <span
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                  style={{
                    background: "var(--bg-sunken)",
                    color: "var(--fg-3)",
                  }}
                >
                  {group.items.length}
                </span>
              </div>
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: {
                    transition: { staggerChildren: 0.06, delayChildren: gi * 0.05 },
                  },
                }}
                className="space-y-3"
              >
                {group.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onRead={() => openReader(item)}
                    suggestions={suggestionsByItem.get(item.id) ?? []}
                    clientName={clientNameFor(item)}
                    clientIdFor={(s) => clientIdFor(item, s)}
                    onPickSuggestionClient={(s, clientId) =>
                      setPickedClient((m) => ({ ...m, [s.id]: clientId }))
                    }
                    onClientsOpen={() => void refreshClients()}
                    statuses={statuses}
                    onAccept={(s) => resolve(s, "accept")}
                    onReject={(s) => resolve(s, "reject")}
                    onExclude={() => resolveItem(item.id, "exclude")}
                    excludeBusy={itemBusy[item.id]}
                    showMailbox={showMailbox}
                    attachClients={clientOptions}
                    onAttachClient={(clientId) => attachClient(item.id, clientId)}
                    attachBusy={attachBusy[item.id]}
                  />
                ))}
              </motion.div>
            </section>
          ))}
        </div>
      ) : uncertainItems.length === 0 ? (
        <div
          className="rounded-lg border bg-[var(--bg-surface)] p-8 text-center"
          style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
        >
          <p className="text-[14px] font-semibold text-[var(--fg-1)]">
            Rien à traiter côté courtage
          </p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] text-[var(--fg-3)]">
            Aucun email lié à votre activité depuis votre dernier briefing. Les
            emails sans rapport (publicités, notifications…) sont écartés
            ci-dessous.
          </p>
        </div>
      ) : null}

      {/* Écartés (hors courtage) */}
      {excludedItems.length > 0 ? (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setShowExcluded((v) => !v)}
            className="inline-flex items-center gap-2 text-[13px] font-medium transition-colors hover:text-[var(--fg-1)]"
            style={{ color: "var(--fg-3)" }}
          >
            <EyeOff className="size-3.5" strokeWidth={1.75} />
            {excludedItems.length} email{excludedItems.length > 1 ? "s" : ""}{" "}
            écarté{excludedItems.length > 1 ? "s" : ""} (hors courtage)
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                showExcluded && "rotate-180",
              )}
              strokeWidth={2}
            />
          </button>
          <AnimatePresence initial={false}>
            {showExcluded ? (
              <motion.ul
                key="excluded-list"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="divide-y overflow-hidden rounded-md border"
                style={{ borderColor: "var(--border-1)" }}
              >
                {excludedItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-3.5 py-2.5"
                    style={{ background: "var(--bg-surface)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-[var(--fg-2)]">
                        {item.from_name || item.from_email || "Expéditeur"}
                        {" — "}
                        <span className="font-normal text-[var(--fg-3)]">
                          {item.subject}
                        </span>
                      </p>
                      {item.exclusion_reason ? (
                        <p className="truncate text-[11px] text-[var(--fg-4)]">
                          {item.exclusion_reason}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => resolveItem(item.id, "keep")}
                        disabled={itemBusy[item.id]}
                        className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--bg-sunken)] disabled:opacity-50"
                        style={{
                          borderColor: "var(--border-1)",
                          color: "var(--fg-2)",
                        }}
                        title="Remettre dans le briefing"
                      >
                        <RotateCcw className="size-3.5" strokeWidth={1.75} />
                        Remettre
                      </button>
                      {/* Lire un email écarté : c'est ainsi qu'on vérifie un
                          tri douteux avant de le remettre dans le briefing. */}
                      <button
                        type="button"
                        onClick={() => openReader(item)}
                        className="flex size-7 items-center justify-center rounded-md text-[var(--fg-4)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-2)]"
                        aria-label="Lire l’email"
                        title="Lire l’email"
                      >
                        <MailOpen className="size-3.5" strokeWidth={1.75} />
                      </button>
                      {item.web_link ? (
                        <a
                          href={item.web_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex size-7 items-center justify-center rounded-md text-[var(--fg-4)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-2)]"
                          aria-label="Ouvrir dans Outlook"
                          title="Ouvrir dans Outlook"
                        >
                          <ExternalLink className="size-3.5" strokeWidth={1.75} />
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </motion.ul>
            ) : null}
          </AnimatePresence>
        </section>
      ) : null}

      <EmailReaderDialog target={reading} onClose={() => setReading(null)} />
    </div>
  );
}
