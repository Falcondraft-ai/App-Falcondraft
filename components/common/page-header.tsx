import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  size = "default",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  size?: "default" | "large";
}) {
  return (
    <div className="flex flex-col justify-between gap-4 pb-5 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow ? <p className="fd-eyebrow mb-2">{eyebrow}</p> : null}
        <h1
          className={cn(
            "font-semibold tracking-[-0.02em] text-[var(--fg-1)]",
            size === "large"
              ? "text-[40px] leading-[1.05]"
              : "text-[28px] leading-[1.15]",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "max-w-2xl text-[var(--fg-3)]",
              size === "large"
                ? "mt-3 text-[15px] leading-6"
                : "mt-2 text-[14px] leading-6",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
