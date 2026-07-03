"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

export function AdviceDeleteButton({
  clientId,
  adviceId,
  redirectTo,
}: {
  clientId: string;
  adviceId: string;
  /** Where to go after deletion (e.g. back to the dossier from the advice page). */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function remove(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    if (
      !window.confirm(
        "Supprimer ce devoir de conseil ? Vous pourrez ensuite en générer un nouveau.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/advice/${adviceId}`,
        { method: "DELETE" },
      ).catch(() => null);
      if (!res?.ok) {
        toast.error("Suppression impossible.");
        return;
      }
      toast.success("Devoir de conseil supprimé.");
      if (redirectTo) router.push(redirectTo);
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
      aria-label="Supprimer le devoir de conseil"
      title="Supprimer le devoir de conseil"
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
