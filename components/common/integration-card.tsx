"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { IntegrationItem } from "@/types/user";
import { cn } from "@/lib/utils";

export function IntegrationCard({ integration }: { integration: IntegrationItem }) {
  const connected = integration.status === "connected";

  return (
    <article className="grid gap-4 border-b px-4 py-4 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">{integration.name}</h2>
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
            <span
              className={cn(
                "size-1.5 rounded-[2px]",
                connected ? "bg-emerald-700" : "bg-muted-foreground/45",
              )}
              aria-hidden="true"
            />
            {connected ? "Actif" : "À configurer"}
          </span>
        </div>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
          {integration.description}
        </p>
      </div>
      <Button
        type="button"
        variant={connected ? "outline" : "default"}
        size="sm"
        onClick={() => {
          toast.success(`${integration.name} : demande enregistrée.`);
        }}
      >
        {integration.actionLabel}
      </Button>
    </article>
  );
}
