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

const toneDot: Record<Exclude<Tone, "neutral">, string> = {
  accent: "var(--brand-amber-500)",
  success: "var(--status-signed-fg)",
  warning: "var(--brand-amber-700)",
  danger: "var(--status-error-fg)",
};

/**
 * Ledger-style stat: eyebrow label (with a state dot when toned), a serif
 * figure, then the reading. `variant="cell"` drops the own chrome so several
 * stats can share one bordered strip (see StatStrip).
 */
export function DashboardStatCard({
  label,
  value,
  detail,
  tone = "neutral",
  deltaTone = "neutral",
  variant = "card",
}: {
  label: ReactNode;
  value: string;
  detail: ReactNode;
  tone?: Tone;
  /** Accepted for backward compatibility — decorative icons are not rendered. */
  icon?: ReactNode;
  deltaTone?: DeltaTone;
  variant?: "card" | "cell";
}) {
  return (
    <section
      className={cn(
        "px-5 py-4",
        variant === "card" &&
          "rounded-lg border border-[var(--border-1)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]",
        variant === "cell" && "bg-[var(--bg-surface)]",
      )}
    >
      <p className="fd-eyebrow flex items-center gap-1.5">
        {tone !== "neutral" ? (
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: toneDot[tone] }}
          />
        ) : null}
        {label}
      </p>
      <p className="fd-serif fd-numeric mt-3 text-[30px] font-semibold leading-none tracking-[-0.01em] text-[var(--fg-1)]">
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

/**
 * One bordered strip holding several stat cells, separated by hairlines in
 * both directions (the 1px gap over the border color does the ruling). Use
 * with `DashboardStatCard variant="cell"` children.
 */
export function StatStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid gap-px overflow-hidden rounded-lg border border-[var(--border-1)] shadow-[var(--shadow-sm)]",
        className,
      )}
      style={{ background: "var(--border-1)" }}
    >
      {children}
    </section>
  );
}
