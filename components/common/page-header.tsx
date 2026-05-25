import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 pb-5 sm:flex-row sm:items-end">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-[var(--foreground)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}
