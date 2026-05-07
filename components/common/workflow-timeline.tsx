import { getWorkflowSteps } from "@/types/workflow";
import type { DealStatus } from "@/types/deal";
import { cn } from "@/lib/utils";

const stepStyles = {
  done: "border-primary bg-primary",
  active: "border-accent bg-accent",
  pending: "border-border bg-background text-muted-foreground",
  failed: "border-red-700 bg-red-700",
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
    <ol
      className={cn(
        "relative space-y-0",
        compact ? "text-xs" : "text-sm",
      )}
    >
      {steps.map((step, index) => (
        <li key={step.id} className="relative grid grid-cols-[1rem_1fr] gap-3">
          {index < steps.length - 1 ? (
            <span
              className="bg-border absolute top-5 bottom-0 left-[7px] w-px"
              aria-hidden="true"
            />
          ) : null}
          <span
            className={cn(
              "relative mt-1 flex h-3 w-2.5 items-center justify-center rounded-[2px] border",
              stepStyles[step.status],
            )}
            aria-hidden="true"
          />
          <div className={cn("pb-4", compact && "pb-3")}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{step.label}</p>
              <span className="text-muted-foreground text-[11px]">
                {step.status === "done"
                  ? "Fait"
                  : step.status === "active"
                    ? "Actif"
                    : step.status === "failed"
                      ? "À corriger"
                      : "À venir"}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 leading-5">
              {step.description}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
