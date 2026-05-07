import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
      <div className="border-l-2 border-primary/75 pl-4">
        {eyebrow ? (
          <p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}
