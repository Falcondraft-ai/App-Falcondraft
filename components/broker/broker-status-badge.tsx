import {
  brokerClientStatusLabels,
  isBrokerClientStatus,
  type BrokerClientStatus,
} from "@/lib/broker/clients";
import { cn } from "@/lib/utils";

type StatusFamily =
  | "draft"
  | "review"
  | "sent"
  | "signed"
  | "archived"
  | "error";

const statusFamily: Record<BrokerClientStatus, StatusFamily> = {
  new: "review",
  in_progress: "sent",
  advice_ready: "review",
  awaiting_signature: "draft",
  signed: "signed",
  closed: "archived",
  lost: "error",
};

const familyTokens: Record<StatusFamily, { fg: string; bg: string; bd: string }> =
  {
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
    archived: {
      fg: "var(--status-archived-fg)",
      bg: "var(--status-archived-bg)",
      bd: "var(--status-archived-bd)",
    },
    error: {
      fg: "var(--status-error-fg)",
      bg: "var(--status-error-bg)",
      bd: "var(--status-error-bd)",
    },
  };

export function BrokerStatusBadge({
  status,
  className,
  showDot = true,
}: {
  status: string;
  className?: string;
  showDot?: boolean;
}) {
  const safeStatus: BrokerClientStatus = isBrokerClientStatus(status)
    ? status
    : "new";
  const tokens = familyTokens[statusFamily[safeStatus]];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-semibold leading-none",
        className,
      )}
      style={{ color: tokens.fg, background: tokens.bg, borderColor: tokens.bd }}
    >
      {showDot ? (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "currentColor" }}
        />
      ) : null}
      {brokerClientStatusLabels[safeStatus]}
    </span>
  );
}
