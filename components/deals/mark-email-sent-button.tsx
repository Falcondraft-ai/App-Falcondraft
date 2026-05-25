"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MarkEmailSentButton({
  dealId,
  variant = "primary",
  className,
  onSuccess,
  stopPropagation = false,
}: {
  dealId: string;
  variant?: "primary" | "compact";
  className?: string;
  onSuccess?: () => void;
  stopPropagation?: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  async function markEmailSent(event?: React.MouseEvent) {
    if (stopPropagation && event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (isPending) return;
    setIsPending(true);

    const response = await fetch(`/api/deals/${dealId}/mark-email-sent`, {
      method: "POST",
    }).catch(() => null);

    setIsPending(false);

    if (!response?.ok) {
      const result: unknown = await response?.json().catch(() => null);
      const message =
        result &&
        typeof result === "object" &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : "Le statut n'a pas pu être mis à jour.";
      toast.error("Mise à jour impossible", { description: message });
      return;
    }

    toast.success("Email marqué comme envoyé", {
      description: "Le dossier passe en statut terminé.",
    });
    onSuccess?.();
    router.refresh();
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={(event) => void markEmailSent(event)}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors disabled:opacity-60",
          className,
        )}
        style={{
          background: "var(--brand-navy-800)",
          color: "#fff",
          border: "1px solid var(--brand-navy-700)",
        }}
        onMouseEnter={(event) =>
          (event.currentTarget.style.background = "var(--brand-navy-700)")
        }
        onMouseLeave={(event) =>
          (event.currentTarget.style.background = "var(--brand-navy-800)")
        }
      >
        <CheckCircle2 className="size-3" strokeWidth={2} />
        {isPending ? "Marquage…" : "Email envoyé"}
      </button>
    );
  }

  return (
    <Button
      type="button"
      onClick={() => void markEmailSent()}
      disabled={isPending}
      className={cn(
        "w-full justify-center gap-2 rounded-md border-0 text-[13px] font-semibold text-white shadow-none",
        className,
      )}
      style={{
        background: "var(--brand-navy-800)",
      }}
    >
      <CheckCircle2 className="size-4" strokeWidth={1.75} />
      {isPending ? "Marquage en cours…" : "Marquer l'email comme envoyé"}
    </Button>
  );
}
