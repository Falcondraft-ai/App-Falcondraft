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
    <section className="overflow-hidden rounded-lg border bg-card/80">
      <div className="border-b px-4 py-3.5">
        <h2 className="text-[0.82rem] font-semibold tracking-[-0.01em]">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm leading-5">
            {description}
          </p>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
