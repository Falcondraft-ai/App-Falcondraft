import Link from "next/link";
import { Check, ChevronRight, FileText } from "lucide-react";
import { AdviceDeleteButton } from "@/components/broker/advice-delete-button";
import { AdviceStatusBadge } from "@/components/broker/advice-status-badge";
import { formatDate } from "@/lib/format";
import type { BrokerAdviceRow } from "@/types/database";

function ProgressToken({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium"
      style={{ color: done ? "var(--fg-2)" : "var(--fg-4)" }}
    >
      {done ? (
        <Check className="size-3" strokeWidth={2.5} aria-hidden />
      ) : (
        <span
          aria-hidden
          className="size-[5px] rounded-full"
          style={{ background: "var(--border-2)" }}
        />
      )}
      {label}
    </span>
  );
}

/**
 * Dossier-page summary of the devoir de conseil. Links to the guided
 * workspace page (review content → PDF → signature) and shows how far the
 * document has progressed.
 */
export function AdviceCard({
  advice,
  clientId,
  hasPdf,
  canDelete,
}: {
  advice: BrokerAdviceRow;
  clientId: string;
  hasPdf: boolean;
  canDelete: boolean;
}) {
  const reviewed = advice.status !== "draft";
  const signed = advice.status === "signed";

  return (
    <div
      className="flex items-center rounded-lg border"
      style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}
    >
      <Link
        href={`/courtier/clients/${clientId}/advice/${advice.id}`}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-3 px-3.5 py-3 transition-colors hover:bg-[var(--bg-sunken)]"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid rgba(184,146,42,0.25)",
            color: "var(--accent-foreground)",
          }}
        >
          <FileText className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
              {advice.title}
            </p>
            <AdviceStatusBadge status={advice.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ProgressToken done={reviewed} label="Contenu" />
            <ProgressToken done={hasPdf} label="PDF" />
            <ProgressToken done={signed} label="Signature" />
            <span className="text-[11px] text-[var(--fg-4)]">
              · Mis à jour le {formatDate(advice.updated_at)}
            </span>
          </div>
        </div>
        <ChevronRight
          className="size-4 shrink-0 text-[var(--fg-4)]"
          strokeWidth={2}
          aria-hidden
        />
      </Link>
      {canDelete ? (
        <AdviceDeleteButton clientId={clientId} adviceId={advice.id} />
      ) : null}
    </div>
  );
}
