import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";
type DeltaTone = "up" | "down" | "neutral";

const detailTone: Record<DeltaTone, string> = {
  up: "text-[var(--status-signed-fg)]",
  down: "text-[var(--status-error-fg)]",
  neutral: "text-[var(--fg-3)]",
};

const iconTone: Record<Tone, string> = {
  neutral: "text-[var(--fg-3)]",
  accent: "text-[var(--brand-amber-700)]",
  success: "text-[var(--status-signed-fg)]",
  warning: "text-[var(--brand-amber-700)]",
  danger: "text-[var(--status-error-fg)]",
};

export function DashboardStatCard({
  label,
  value,
  detail,
  tone = "neutral",
  icon,
  deltaTone = "neutral",
}: {
  label: ReactNode;
  value: string;
  detail: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  deltaTone?: DeltaTone;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-lg border bg-[var(--bg-surface)] px-5 py-4",
        "border-[var(--border-1)] shadow-[var(--shadow-sm)]",
        "transition-shadow duration-200 ease-out hover:shadow-[var(--shadow-md)]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="fd-eyebrow">{label}</p>
        {icon ? (
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center",
              iconTone[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="fd-numeric mt-3 text-[28px] font-semibold leading-none tracking-[-0.015em] text-[var(--fg-1)]">
        {value}
      </p>
      <p
        className={cn(
          "mt-2 inline-flex items-center gap-1 text-[12px] font-medium leading-5",
          detailTone[deltaTone],
        )}
      >
        {deltaTone === "up" ? (
          <ChevronUp className="size-3" strokeWidth={2.25} aria-hidden="true" />
        ) : null}
        {deltaTone === "down" ? (
          <ChevronDown
            className="size-3"
            strokeWidth={2.25}
            aria-hidden="true"
          />
        ) : null}
        {detail}
      </p>
    </section>
  );
}
