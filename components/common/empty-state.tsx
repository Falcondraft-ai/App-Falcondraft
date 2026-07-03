import type { ReactNode } from "react";

/**
 * Quiet editorial empty state: the small amber rule (the FalconDraft
 * signature tick), a serif title, one useful sentence, one next action.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="rounded-lg border px-6 py-10 text-center"
      style={{ borderColor: "var(--border-1)", background: "var(--bg-rail)" }}
    >
      <span
        aria-hidden
        className="mx-auto block h-[2px] w-6"
        style={{ background: "var(--accent)" }}
      />
      <h2 className="fd-serif mt-4 text-[17px] font-semibold tracking-[-0.01em] text-[var(--fg-1)]">
        {title}
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-6 text-[var(--fg-3)]">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
