import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function DashboardStatCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: ReactNode;
  value: string;
  detail: ReactNode;
  tone?: "neutral" | "accent" | "success";
}) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-[var(--background-card)] px-5 py-4 shadow-sm",
        "border-[var(--border)]",
        tone === "accent" && "border-l-2 border-l-[var(--accent)]",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2.5 text-[28px] font-semibold leading-none tracking-tight text-[var(--foreground)]">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
        {detail}
      </p>
    </section>
  );
}
