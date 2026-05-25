import { getWorkflowSteps } from "@/types/workflow";
import { T } from "@/components/i18n/translated-text";
import type { DealStatus } from "@/types/deal";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/translations";

const stepStyles = {
  done: "border-[var(--muted-foreground)] bg-[var(--muted-foreground)]",
  active: "border-[var(--accent)] bg-[var(--accent)]",
  pending: "border-[var(--border)] bg-[var(--background)]",
  failed: "border-red-600 bg-red-600",
} as const;

export function WorkflowTimeline({
  status,
  compact = false,
}: {
  status: DealStatus;
  compact?: boolean;
}) {
  const steps = getWorkflowSteps(status);

  return (
    <ol className={cn("relative space-y-0", compact ? "text-xs" : "text-sm")}>
      {steps.map((step, index) => (
        <li key={step.id} className="relative grid grid-cols-[1rem_1fr] gap-3">
          {index < steps.length - 1 ? (
            <span
              className="bg-[var(--border)] absolute top-4 bottom-0 left-[2.5px] w-px"
              aria-hidden="true"
            />
          ) : null}
          <span
            className={cn(
              "relative mt-1.5 block h-1.5 w-1.5 rounded-[1px] border",
              stepStyles[step.status],
            )}
            aria-hidden="true"
          />
          <div className={cn("pb-4", compact && "pb-3")}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">
                <T tx={`workflow.${step.id}.label` as TranslationKey} />
              </p>
              <span className="text-muted-foreground text-[11px]">
                {step.status === "done" ? (
                  <T tx="common.status.done" />
                ) : step.status === "active" ? (
                  <T tx="common.status.active" />
                ) : step.status === "failed" ? (
                  <T tx="common.status.failed" />
                ) : (
                  <T tx="common.status.pending" />
                )}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 leading-5">
              <T tx={`workflow.${step.id}.description` as TranslationKey} />
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
