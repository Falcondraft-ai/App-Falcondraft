"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Permanent deletion of a client dossier and everything attached (documents,
 * contracts, quotes, advice, claims, commissions, compliance). Manager-only,
 * irreversible — guarded by a type-to-confirm dialog.
 *
 * - `variant="detail"` renders a full ghost button and redirects to the list.
 * - `variant="row"` renders a compact icon button and refreshes the table.
 */
export function ClientDeleteButton({
  clientId,
  clientName,
  variant = "detail",
}: {
  clientId: string;
  clientName: string;
  variant?: "detail" | "row";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");

  const canConfirm =
    confirmText.trim().toLowerCase() === clientName.trim().toLowerCase();

  async function remove() {
    if (busy || !canConfirm) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/broker/clients/${clientId}`, {
        method: "DELETE",
      }).catch(() => null);
      if (!res?.ok) {
        toast.error("Suppression impossible.");
        return;
      }
      toast.success("Dossier supprimé définitivement.");
      setOpen(false);
      if (variant === "detail") {
        router.push("/courtier/clients");
        router.refresh();
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) setConfirmText("");
      }}
    >
      <AlertDialogTrigger asChild>
        {variant === "row" ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(true);
            }}
            aria-label="Supprimer le dossier"
            title="Supprimer le dossier"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--destructive-soft)]"
            style={{ color: "var(--destructive)" }}
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors hover:bg-[var(--destructive-soft)]"
            style={{
              borderColor: "var(--border-1)",
              color: "var(--destructive)",
            }}
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
            Supprimer le dossier
          </button>
        )}
      </AlertDialogTrigger>

      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-[var(--destructive-soft)] text-[var(--destructive)]">
            <TriangleAlert strokeWidth={1.75} />
          </AlertDialogMedia>
          <AlertDialogTitle>Supprimer « {clientName} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est <strong>irréversible</strong>. Tout le dossier sera
            supprimé : documents et pièces jointes, contrats, devis, devoirs de
            conseil, sinistres, commissions et conformité.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <label
            htmlFor={`confirm-delete-${clientId}`}
            className="text-[12px] text-[var(--fg-3)]"
          >
            Pour confirmer, saisissez le nom du dossier :
          </label>
          <input
            id={`confirm-delete-${clientId}`}
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={clientName}
            autoComplete="off"
            className="h-9 w-full rounded-md border bg-[var(--bg-surface)] px-3 text-[13px] outline-none transition-colors focus:border-[var(--border-focus)]"
            style={{ borderColor: "var(--border-1)", color: "var(--fg-1)" }}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm || busy}
            onClick={remove}
          >
            {busy ? (
              <>
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                Suppression…
              </>
            ) : (
              "Supprimer définitivement"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
