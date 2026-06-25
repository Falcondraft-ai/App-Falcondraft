import {
  brokerCommissionStatusLabels,
  brokerCommissionStatusTone,
  brokerStatementStatusLabels,
  brokerStatementStatusTone,
  isBrokerCommissionStatus,
  isBrokerStatementStatus,
} from "@/lib/broker/commissions";
import { cn } from "@/lib/utils";

const toneTokens: Record<
  "draft" | "review" | "signed" | "error",
  { fg: string; bg: string; bd: string }
> = {
  draft: {
    fg: "var(--status-draft-fg)",
    bg: "var(--status-draft-bg)",
    bd: "var(--status-draft-bd)",
  },
  review: {
    fg: "var(--status-review-fg)",
    bg: "var(--status-review-bg)",
    bd: "var(--status-review-bd)",
  },
  signed: {
    fg: "var(--status-signed-fg)",
    bg: "var(--status-signed-bg)",
    bd: "var(--status-signed-bd)",
  },
  error: {
    fg: "var(--status-error-fg)",
    bg: "var(--status-error-bg)",
    bd: "var(--status-error-bd)",
  },
};

export function CommissionStatusBadge({
  status,
  kind = "line",
  className,
}: {
  status: string;
  kind?: "statement" | "line";
  className?: string;
}) {
  let label: string;
  let tone: keyof typeof toneTokens;

  if (kind === "statement") {
    const safe = isBrokerStatementStatus(status) ? status : "received";
    label = brokerStatementStatusLabels[safe];
    tone = brokerStatementStatusTone[safe];
  } else {
    const safe = isBrokerCommissionStatus(status) ? status : "expected";
    label = brokerCommissionStatusLabels[safe];
    tone = brokerCommissionStatusTone[safe];
  }

  const tokens = toneTokens[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-semibold leading-none",
        className,
      )}
      style={{ color: tokens.fg, background: tokens.bg, borderColor: tokens.bd }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "currentColor" }}
      />
      {label}
    </span>
  );
}
