import {
  brokerAdviceStatusLabels,
  brokerAdviceStatusTone,
  isBrokerAdviceStatus,
  type BrokerAdviceStatus,
} from "@/lib/broker/advice";
import { cn } from "@/lib/utils";

const toneTokens: Record<
  "draft" | "review" | "sent" | "signed",
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
  sent: {
    fg: "var(--status-sent-fg)",
    bg: "var(--status-sent-bg)",
    bd: "var(--status-sent-bd)",
  },
  signed: {
    fg: "var(--status-signed-fg)",
    bg: "var(--status-signed-bg)",
    bd: "var(--status-signed-bd)",
  },
};

export function AdviceStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const safe: BrokerAdviceStatus = isBrokerAdviceStatus(status)
    ? status
    : "draft";
  const tokens = toneTokens[brokerAdviceStatusTone[safe]];

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
      {brokerAdviceStatusLabels[safe]}
    </span>
  );
}
