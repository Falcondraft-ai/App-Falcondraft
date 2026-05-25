import type { ReactNode } from "react";

export function ActionCard({
  title,
  description,
  eyebrow,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-lg border bg-[var(--bg-surface)]"
      style={{
        borderColor: "var(--border-1)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        className="flex items-start justify-between gap-3 border-b px-5 py-4"
        style={{ borderColor: "var(--border-1)" }}
      >
        <div className="min-w-0">
          {eyebrow ? <p className="fd-eyebrow mb-1">{eyebrow}</p> : null}
          <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.005em] text-[var(--fg-1)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 text-[13px] leading-5 text-[var(--fg-3)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
