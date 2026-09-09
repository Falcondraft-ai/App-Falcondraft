"use client";

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
import { cn } from "@/lib/utils";

/**
 * Met un email à la corbeille de la messagerie.
 *
 * La publicité et les notifications de plateformes n'ont rien à faire dans un
 * outil de courtage : les écarter du briefing ne suffisait pas, elles
 * revenaient au briefing suivant puisque l'email restait dans la boîte.
 *
 * Le libellé dit exactement ce qui se passe — l'email part dans la corbeille de
 * la messagerie, pas dans un purgatoire propre à FalconDraft. C'est là que le
 * courtier ira le repêcher s'il s'est trompé, et c'est cette corbeille-là qui
 * se vide seule au bout de son délai de rétention.
 */
export function DeleteEmailButton({
  messageId,
  subject,
  onDeleted,
  variant = "inline",
}: {
  messageId: string;
  subject?: string | null;
  onDeleted: () => void;
  /** "inline" dans une barre d'actions, "icon" dans un en-tête compact. */
  variant?: "inline" | "icon";
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/courtier/mailbox/message?id=${encodeURIComponent(messageId)}`,
        { method: "DELETE" },
      ).catch(() => null);
      const data = (await res?.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;

      if (!res?.ok || !data?.success) {
        toast.error("Suppression impossible.", {
          description: data?.message ?? "Réessayez dans un instant.",
        });
        return;
      }

      setOpen(false);
      onDeleted();
      toast.success("Email mis à la corbeille de votre messagerie.");
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
      }}
    >
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label="Supprimer l’email"
          title="Supprimer l’email"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md transition-colors hover:bg-[var(--destructive-soft)]",
            variant === "icon"
              ? "size-7 items-center justify-center border"
              : "h-7 border px-2.5 text-[12px] font-medium",
          )}
          style={{
            borderColor: "var(--border-1)",
            color: "var(--destructive)",
          }}
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
          {variant === "inline" ? "Supprimer" : null}
        </button>
      </AlertDialogTrigger>

      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-[var(--destructive-soft)] text-[var(--destructive)]">
            <TriangleAlert strokeWidth={1.75} />
          </AlertDialogMedia>
          <AlertDialogTitle>Supprimer cet email ?</AlertDialogTitle>
          <AlertDialogDescription>
            {subject ? <>« {subject} » partira</> : <>Cet email partira</>} dans
            la corbeille de votre messagerie, où vous pourrez le récupérer
            jusqu’à ce qu’elle se vide. Il disparaîtra aussi de votre briefing.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy ? (
              <>
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                Suppression…
              </>
            ) : (
              "Mettre à la corbeille"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
