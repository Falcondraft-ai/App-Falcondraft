"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

/**
 * Trash button for a list row, with the same two-step confirmation as the
 * dossier's GED: the first click asks, the second deletes. Deletion is
 * permanent, so it never happens on a single click.
 */
export function DeleteRowButton({
  endpoint,
  label,
  successMessage,
}: {
  /** DELETE endpoint of the record. */
  endpoint: string;
  /** What is deleted, for screen readers ("Supprimer le document"). */
  label: string;
  successMessage: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE" }).catch(() => null);
      if (!res?.ok) {
        const data = (await res?.json().catch(() => null)) as {
          message?: string;
        } | null;
        toast.error("Suppression impossible", { description: data?.message });
        return;
      }
      toast.success(successMessage);
      setConfirming(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-md px-2 py-1 text-[12px] font-semibold"
          style={{
            background: "var(--status-error-bg)",
            color: "var(--status-error-fg)",
            border: "1px solid var(--status-error-bd)",
          }}
        >
          {busy ? "…" : "Supprimer"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="rounded-md px-2 py-1 text-[12px] text-[var(--fg-3)]"
        >
          Annuler
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-md text-[var(--fg-3)] transition-colors hover:bg-[var(--status-error-bg)] hover:text-[var(--status-error-fg)]"
    >
      <Trash2 className="size-4" strokeWidth={1.75} />
    </button>
  );
}
