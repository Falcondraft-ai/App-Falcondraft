import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="border border-dashed bg-card/65 px-6 py-8 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-6">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
