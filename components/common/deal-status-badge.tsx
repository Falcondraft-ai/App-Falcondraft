import { T } from "@/components/i18n/translated-text";
import type { DealStatus } from "@/types/deal";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/translations";

const statusStyles = {
  draft: "border-slate-300 text-slate-700 bg-transparent",
  call_summary_ready: "border-slate-300 text-slate-800 bg-transparent",
  proposal_generating: "border-amber-500/45 text-amber-900 bg-transparent",
  proposal_ready: "border-slate-400 text-slate-900 bg-transparent",
  validation_pending: "border-accent/55 text-primary bg-transparent",
  final_document_generating:
    "border-amber-500/45 text-amber-900 bg-transparent",
  final_document_ready: "border-emerald-700/35 text-emerald-900 bg-transparent",
  signature_ready: "border-emerald-700/35 text-emerald-900 bg-transparent",
  email_draft_ready: "border-slate-400 text-slate-900 bg-transparent",
  completed: "border-emerald-700/35 text-emerald-900 bg-transparent",
  failed: "border-red-700/45 text-red-900 bg-transparent",
} satisfies Record<DealStatus, string>;

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
        "inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-medium",
        statusStyles[status],
        className,
      )}
    >
      <span className="h-3 w-1 bg-current opacity-55" aria-hidden="true" />
      <T tx={`dealStatus.${status}` as TranslationKey} />
    </span>
  );
}
