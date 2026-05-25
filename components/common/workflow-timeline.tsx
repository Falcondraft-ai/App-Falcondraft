import { getWorkflowSteps } from "@/types/workflow";
import { T } from "@/components/i18n/translated-text";
import type { DealStatus } from "@/types/deal";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/translations";

type StepStatus = "done" | "active" | "pending" | "failed";

const nodeStyles: Record<StepStatus, string> = {
  done: "border-[var(--brand-navy-800)] bg-[var(--brand-navy-800)] text-white",
  active:
    "border-[var(--brand-amber-500)] bg-white text-[var(--brand-amber-700)] shadow-[0_0_0_4px_rgba(216,152,56,0.18)]",
  pending: "border-[var(--border-2)] bg-white text-transparent",
  failed: "border-[var(--status-error-fg)] bg-[var(--status-error-fg)] text-white",
};

const railStyles: Record<StepStatus, string> = {
  done: "bg-[var(--brand-navy-800)]",
  active: "bg-[var(--border-2)]",
  pending: "bg-[var(--border-2)]",
  failed: "bg-[var(--status-error-fg)]",
};

const labelStyles: Record<StepStatus, string> = {
  done: "text-[var(--fg-1)]",
  active: "text-[var(--brand-amber-800)] font-semibold",
  pending: "text-[var(--fg-4)]",
  failed: "text-[var(--status-error-fg)] font-semibold",
};

export function WorkflowTimeline({
  status,
  compact = false,
}: {
  status: DealStatus;
  compact?: boolean;
}) {
  const steps = getWorkflowSteps(status);

  return (
    <ol className={cn("relative", compact ? "text-xs" : "text-sm")}>
      {steps.map((step, index) => {
        const stepStatus = step.status as StepStatus;
        const isLast = index === steps.length - 1;
        const dotSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";
        return (
          <li
            key={step.id}
            className={cn(
              "relative grid grid-cols-[16px_1fr] gap-3",
              compact ? "pb-3" : "pb-4",
              isLast && "pb-0",
            )}
          >
            {!isLast ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-4 left-[7px] w-px",
                  compact ? "bottom-1" : "bottom-2",
                  railStyles[stepStatus],
                )}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 mt-[3px] flex items-center justify-center rounded-full border-2 transition-shadow duration-200",
                dotSize,
                nodeStyles[stepStatus],
              )}
            >
              {stepStatus === "done" ? (
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
              ) : stepStatus === "active" ? (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--brand-amber-500)" }}
                />
              ) : null}
            </span>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className={cn("leading-tight", labelStyles[stepStatus])}>
                  <T tx={`workflow.${step.id}.label` as TranslationKey} />
                </p>
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--fg-4)]">
                  {stepStatus === "done" ? (
                    <T tx="common.status.done" />
                  ) : stepStatus === "active" ? (
                    <T tx="common.status.active" />
                  ) : stepStatus === "failed" ? (
                    <T tx="common.status.failed" />
                  ) : (
                    <T tx="common.status.pending" />
                  )}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-5 text-[var(--fg-3)]">
                <T tx={`workflow.${step.id}.description` as TranslationKey} />
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
