import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared page header. The bottom hairline with its small amber tick is the
 * FalconDraft signature rule — keep it consistent across pages.
 */
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
    <div
      className="relative flex flex-col justify-between gap-3 border-b pb-5 sm:flex-row sm:items-end sm:gap-4"
      style={{ borderColor: "var(--border-1)" }}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="fd-eyebrow mb-2">{eyebrow}</p> : null}
        <h1
          className={cn(
            "font-semibold tracking-[-0.02em] text-[var(--fg-1)]",
            size === "large"
              ? "text-[26px] leading-[1.15] sm:text-[32px] sm:leading-[1.12] md:text-[40px] md:leading-[1.05]"
              : "text-[22px] leading-tight sm:text-[26px] md:text-[28px] md:leading-[1.15]",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "max-w-2xl text-[var(--fg-3)]",
              size === "large"
                ? "mt-2 text-[13px] leading-5 sm:mt-3 sm:text-[14px] md:text-[15px] md:leading-6"
                : "mt-2 text-[13px] leading-5 sm:text-[14px] sm:leading-6",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
      <span
        aria-hidden
        className="absolute -bottom-px left-0 h-[2px] w-10"
        style={{ background: "var(--accent)" }}
      />
    </div>
  );
}
