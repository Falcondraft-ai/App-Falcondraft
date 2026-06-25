"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  Check,
  ExternalLink,
  FileSignature,
  Mail,
  MessageSquare,
  Paperclip,
  PenLine,
  Receipt,
  ScrollText,
  ShieldAlert,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  emailCategoryLabel,
  emailCategoryOrder,
  senderInitials,
  suggestionAcceptLabels,
  suggestionTypeLabels,
  type EmailCategory,
  type SuggestionType,
} from "@/lib/broker/outlook";
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
  declare_claim: <ShieldAlert className="size-3.5" strokeWidth={1.75} />,
  flag_renewal: <CalendarClock className="size-3.5" strokeWidth={1.75} />,
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
    case "attach_document": {
      const file = pstr(p, "file_name") ?? "pièce jointe";
      return clientName
        ? `Ranger « ${file} » dans le dossier ${clientName}`
        : `Ranger « ${file} » (choisir un dossier)`;
    }
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
  status,
  onAccept,
  onReject,
}: {
  suggestion: BrokerEmailSuggestionRow;
  clientName: string | null;
  status: LocalStatus;
  onAccept: () => void;
  onReject: () => void;
}) {
  const type = suggestion.type as SuggestionType;
  const resolved = status === "done" || status === "rejected";

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
      <p
        className={cn(
          "min-w-0 flex-1 text-[12.5px]",
          status === "rejected"
            ? "text-[var(--fg-4)] line-through"
            : "text-[var(--fg-2)]",
        )}
      >
        {suggestionDescription(suggestion, clientName)}
      </p>

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
              disabled={status === "loading"}
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

function ItemCard({
  item,
  suggestions,
  clientNames,
  statuses,
  onAccept,
  onReject,
}: {
  item: BrokerEmailItemRow;
  suggestions: BrokerEmailSuggestionRow[];
  clientNames: Record<string, string>;
  statuses: Record<string, LocalStatus>;
  onAccept: (s: BrokerEmailSuggestionRow) => void;
  onReject: (s: BrokerEmailSuggestionRow) => void;
}) {
  const clientName = item.suggested_client_id
    ? (clientNames[item.suggested_client_id] ?? null)
    : null;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-lg border bg-[var(--bg-surface)] p-4"
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
          style={{
            background: "var(--brand-navy-50)",
            color: "var(--brand-navy-700)",
            border: "1px solid var(--border-1)",
          }}
        >
          {senderInitials(item.from_name || item.from_email)}
        </span>
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
          <p className="mt-1 font-mono text-[11px] text-[var(--fg-4)]">
            {item.received_at ? formatDateTime(item.received_at) : ""}
          </p>
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
              status={statuses[s.id] ?? "pending"}
              onAccept={() => onAccept(s)}
              onReject={() => onReject(s)}
            />
          ))}
        </div>
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

  const suggestionsByItem = React.useMemo(() => {
    const map = new Map<string, BrokerEmailSuggestionRow[]>();
    for (const s of suggestions) {
      const list = map.get(s.item_id) ?? [];
      list.push(s);
      map.set(s.item_id, list);
    }
    return map;
  }, [suggestions]);

  const pendingActions = React.useMemo(
    () =>
      suggestions.filter((s) => (statuses[s.id] ?? "pending") === "pending")
        .length,
    [suggestions, statuses],
  );
  const attachmentCount = suggestions.filter(
    (s) => s.type === "attach_document",
  ).length;

  async function resolve(s: BrokerEmailSuggestionRow, action: "accept" | "reject") {
    if ((statuses[s.id] ?? "pending") !== "pending") return;
    setStatuses((m) => ({ ...m, [s.id]: "loading" }));
    try {
      const res = await fetch(`/api/courtier/outlook/suggestions/${s.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }).catch(() => null);
      const result = (await res?.json().catch(() => null)) as
        | { success?: boolean; message?: string; status?: string }
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
    } catch {
      setStatuses((m) => ({ ...m, [s.id]: "pending" }));
    }
  }

  // Group items by category in display order.
  const grouped = React.useMemo(() => {
    const byCat = new Map<string, BrokerEmailItemRow[]>();
    for (const item of items) {
      const cat = item.category ?? "other_broker";
      const list = byCat.get(cat) ?? [];
      list.push(item);
      byCat.set(cat, list);
    }
    const ordered: { category: string; items: BrokerEmailItemRow[] }[] = [];
    for (const cat of emailCategoryOrder) {
      const list = byCat.get(cat);
      if (list && list.length) ordered.push({ category: cat, items: list });
      byCat.delete(cat);
    }
    for (const [cat, list] of byCat) ordered.push({ category: cat, items: list });
    return ordered;
  }, [items]);

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
            <GenerateDigestButton variant="ghost" />
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
            <StatChip value={digest.relevant_count} label="Emails à traiter" />
            <StatChip value={attachmentCount} label="Pièces jointes" />
            <StatChip value={pendingActions} label="Actions proposées" />
            <StatChip value={digest.excluded_count} label="Écartés (hors courtage)" />
          </motion.div>
          {digest.generated_at ? (
            <p className="mt-3 text-[11px] text-[var(--fg-4)]">
              Généré le {formatDateTime(digest.generated_at)}
            </p>
          ) : null}
        </div>
      </motion.section>

      {/* Grouped items */}
      {items.length > 0 ? (
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
                    suggestions={suggestionsByItem.get(item.id) ?? []}
                    clientNames={clientNames}
                    statuses={statuses}
                    onAccept={(s) => resolve(s, "accept")}
                    onReject={(s) => resolve(s, "reject")}
                  />
                ))}
              </motion.div>
            </section>
          ))}
        </div>
      ) : (
        <div
          className="rounded-lg border bg-[var(--bg-surface)] p-8 text-center"
          style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
        >
          <p className="text-[14px] font-semibold text-[var(--fg-1)]">
            Rien à traiter côté courtage
          </p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] text-[var(--fg-3)]">
            Aucun email lié à votre activité depuis votre dernier briefing. Les
            emails sans rapport (publicités, notifications…) sont automatiquement
            écartés.
          </p>
        </div>
      )}
    </div>
  );
}
