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
    <div className="flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-end">
      <div className="border-primary/75 border-l-2 pl-4">
        {eyebrow ? (
          <p className="text-muted-foreground text-xs font-medium tracking-[0.12em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.045em] sm:text-[2rem]">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-6">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}
