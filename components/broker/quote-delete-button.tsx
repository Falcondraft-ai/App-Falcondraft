"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

export function QuoteDeleteButton({
  clientId,
  quoteId,
}: {
  clientId: string;
  quoteId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function remove(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    if (
      !window.confirm(
        "Supprimer définitivement ce devis ? Cette action est irréversible.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/quotes/${quoteId}`,
        { method: "DELETE" },
      ).catch(() => null);
      if (!res?.ok) {
        toast.error("Suppression impossible.");
        return;
      }
      toast.success("Devis supprimé.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      aria-label="Supprimer le devis"
      title="Supprimer le devis"
      className="mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--destructive-soft)] disabled:opacity-50"
      style={{ color: "var(--destructive)" }}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <Trash2 className="size-3.5" strokeWidth={1.75} />
      )}
    </button>
  );
}
