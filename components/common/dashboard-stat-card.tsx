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
        "group bg-card/70 hover:bg-card/90 rounded-xl border px-4 py-3.5 shadow-[0_16px_55px_-48px_rgba(20,32,51,0.75)] transition-all duration-200 hover:-translate-y-0.5",
        tone === "accent" && "border-l-accent bg-accent/[0.07] border-l-4",
        tone === "success" && "bg-card/80 border-l-4 border-l-emerald-700",
      )}
    >
      <p className="text-muted-foreground text-xs font-medium tracking-[0.01em]">
        {label}
      </p>
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <p className="font-mono text-2xl font-semibold tracking-tight">
          {value}
        </p>
      </div>
      <p className="text-muted-foreground mt-1 text-xs leading-5">{detail}</p>
    </section>
  );
}
