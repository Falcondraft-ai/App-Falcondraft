import { cn } from "@/lib/utils";

export function DashboardStatCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "accent" | "success";
}) {
  return (
    <section
      className={cn(
        "border-l bg-card/55 px-4 py-3.5",
        tone === "accent" && "border-l-accent bg-accent/[0.07]",
        tone === "success" && "border-l-emerald-700 bg-card/70",
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
