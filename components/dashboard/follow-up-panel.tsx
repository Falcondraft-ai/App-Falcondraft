import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DealStatusBadge } from "@/components/common/deal-status-badge";
import { T } from "@/components/i18n/translated-text";
import type { Deal, DealStatus } from "@/types/deal";
import { formatDate } from "@/lib/format";

type FollowUpDeal = Pick<
  Deal,
  "id" | "name" | "clientCompanyName" | "status" | "updatedAt" | "lastAction"
>;

type NodeStatus = "done" | "active" | "pending" | "failed";

function getNodeStatus(status: DealStatus): NodeStatus {
  if (status === "completed") return "done";
  if (status === "failed") return "failed";
  if (
    status === "signature_ready" ||
    status === "email_draft_ready" ||
    status === "validation_pending"
  ) {
    return "active";
  }
  return "pending";
}

const nodeStyles: Record<NodeStatus, React.CSSProperties> = {
  done: {
    background: "var(--brand-navy-800)",
    borderColor: "var(--brand-navy-800)",
    color: "#fff",
  },
  active: {
    background: "#fff",
    borderColor: "var(--accent)",
    color: "var(--accent)",
    boxShadow: "0 0 0 4px rgba(184,146,42,0.18)",
  },
  pending: {
    background: "#fff",
    borderColor: "var(--border-2)",
    color: "transparent",
  },
  failed: {
    background: "var(--status-error-fg)",
    borderColor: "var(--status-error-fg)",
    color: "#fff",
  },
};

export function FollowUpPanel({ deals }: { deals: FollowUpDeal[] }) {
  return (
    <section
      className="flex flex-col rounded-lg border bg-[var(--bg-surface)] p-5"
      style={{
        borderColor: "var(--border-1)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.005em] text-[var(--fg-1)]">
            <T tx="dashboard.followUp.title" />
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--fg-3)]">
            Progression visuelle de vos dossiers ouverts.
          </p>
        </div>
        {deals.length > 0 ? (
          <span
            className="fd-meta font-semibold"
            style={{ color: "var(--accent-foreground)" }}
          >
            {deals.length}
          </span>
        ) : null}
      </header>

      {deals.length === 0 ? (
        <p className="text-[13px] leading-5 text-[var(--fg-3)]">
          <T tx="dashboard.followUp.empty" />
        </p>
      ) : (
        <ol className="relative flex flex-1 flex-col">
          {deals.map((deal, index) => {
            const isLeft = index % 2 === 0;
            const isLast = index === deals.length - 1;
            const nodeState = getNodeStatus(deal.status);
            const dotStyle = nodeStyles[nodeState];
            return (
              <li
                key={deal.id}
                className="relative flex"
                style={{
                  flexDirection: isLeft ? "row" : "row-reverse",
                  paddingBottom: isLast ? 0 : 14,
                }}
              >
                {/* Node + road segment */}
                <div className="relative flex w-[28px] shrink-0 flex-col items-center">
                  <span
                    aria-hidden
                    className="z-10 mt-1 flex h-4 w-4 items-center justify-center rounded-full border-2 transition-shadow"
                    style={dotStyle}
                  >
                    {nodeState === "done" ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-2.5 w-2.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m5 12 5 5 9-9" />
                      </svg>
                    ) : nodeState === "active" ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: "var(--accent)" }}
                      />
                    ) : null}
                  </span>
                  {!isLast ? (
                    <span
                      aria-hidden
                      className="absolute top-[18px] bottom-[-14px] w-[1.5px]"
                      style={{ background: "var(--border-2)" }}
                    />
                  ) : null}
                </div>

                {/* Curve connector to the next row */}
                {!isLast ? (
                  <svg
                    aria-hidden
                    viewBox="0 0 40 32"
                    className="pointer-events-none absolute bottom-[-4px] h-6 w-10"
                    style={{
                      left: isLeft ? "16px" : "auto",
                      right: isLeft ? "auto" : "16px",
                      transform: isLeft ? undefined : "scaleX(-1)",
                    }}
                  >
                    <path
                      d="M0 4 Q 20 4 20 16 Q 20 28 40 28"
                      fill="none"
                      stroke="var(--border-2)"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  </svg>
                ) : null}

                {/* Deal card */}
                <Link
                  href={`/dashboard/deals/${deal.id}`}
                  className="group ml-2 mr-2 min-w-0 flex-1 rounded-md border px-3 py-2.5 transition-colors"
                  style={{
                    background: "var(--brand-navy-50)",
                    borderColor: "var(--border-1)",
                    textAlign: isLeft ? "left" : "right",
                  }}
                >
                  <div
                    className="flex items-baseline gap-2"
                    style={{
                      flexDirection: isLeft ? "row" : "row-reverse",
                    }}
                  >
                    <span className="truncate text-[13px] font-semibold text-[var(--fg-1)] group-hover:text-[var(--brand-navy-800)]">
                      {deal.clientCompanyName || deal.name}
                    </span>
                    <span className="font-mono text-[10.5px] text-[var(--fg-4)]">
                      {formatDate(deal.updatedAt)}
                    </span>
                  </div>
                  <div
                    className="mt-1 flex items-center gap-2"
                    style={{
                      flexDirection: isLeft ? "row" : "row-reverse",
                    }}
                  >
                    <DealStatusBadge status={deal.status} />
                    <span className="truncate text-[11.5px] text-[var(--fg-3)]">
                      {deal.name}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <div
        className="mt-4 flex items-center justify-end border-t pt-3"
        style={{ borderColor: "var(--border-1)" }}
      >
        <Link
          href="/dashboard/deals"
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--brand-navy-700)] transition-colors hover:text-[var(--brand-navy-900)]"
        >
          <T tx="dashboard.followUp.viewAll" />
          <ArrowRight className="size-3" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
