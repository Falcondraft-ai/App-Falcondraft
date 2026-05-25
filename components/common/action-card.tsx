import type { ReactNode } from "react";

export function ActionCard({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-lg border bg-[var(--background-card)]"
      style={{
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="border-b px-4 py-3.5" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-[13px] font-medium tracking-[-0.005em] text-[var(--foreground)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-[var(--muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
