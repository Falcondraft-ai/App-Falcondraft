import { T } from "@/components/i18n/translated-text";
import type { DealStatus } from "@/types/deal";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/translations";

const indicatorTone: Record<DealStatus, string> = {
  draft: "bg-[var(--muted-foreground)]/55",
  call_summary_ready: "bg-[var(--muted-foreground)]/70",
  proposal_generating: "bg-amber-500",
  proposal_ready: "bg-[var(--accent)]",
  validation_pending: "bg-[var(--accent)]",
  final_document_generating: "bg-amber-500",
  final_document_ready: "bg-emerald-600",
  signature_ready: "bg-emerald-600",
  email_draft_ready: "bg-[var(--accent)]",
  completed: "bg-emerald-600",
  failed: "bg-red-600",
};

export function DealStatusBadge({
  status,
  className,
}: {
  status: DealStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-xs font-medium",
        "bg-[var(--accent-soft)] text-[var(--accent-foreground)]",
        "border-[rgba(184,146,42,0.2)]",
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-[1px]", indicatorTone[status])}
        aria-hidden="true"
      />
      <T tx={`dealStatus.${status}` as TranslationKey} />
    </span>
  );
}
