"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Trash button for a list row. Deletion is permanent, so it is always
 * confirmed — in a dialog rather than inside the row: an inline confirmation
 * widens the row's last column and pushes the table past the screen.
 */
export function DeleteRowButton({
  endpoint,
  label,
  itemName,
  successMessage,
}: {
  /** DELETE endpoint of the record. */
  endpoint: string;
  /** What is deleted, for the button and the dialog title ("Supprimer le document"). */
  label: string;
  /** Name shown in the confirmation, so the broker knows exactly what goes. */
  itemName?: string;
  successMessage: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
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
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--fg-3)] transition-colors hover:bg-[var(--status-error-bg)] hover:text-[var(--status-error-fg)]"
      >
        <Trash2 className="size-4" strokeWidth={1.75} />
      </button>
      <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{label} ?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemName ? (
                <>
                  <span className="font-medium text-[var(--fg-1)]">{itemName}</span>{" "}
                  sera supprimé définitivement.
                </>
              ) : (
                "Cette suppression est définitive."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                // Stays open until the server answers: a failure is shown here,
                // not after the dialog has already said it was done.
                event.preventDefault();
                void remove();
              }}
              style={{
                background: "var(--destructive-soft)",
                color: "var(--destructive)",
                border: "1px solid var(--destructive)",
              }}
            >
              {busy ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
