"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { MailSearch, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GenerateDigestButton({
  variant = "primary",
  label = "Générer mon briefing",
}: {
  variant?: "primary" | "ghost";
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function generate() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/courtier/outlook/digest", {
        method: "POST",
      }).catch(() => null);
      const result = (await res?.json().catch(() => null)) as
        | {
            success?: boolean;
            message?: string;
            relevant?: number;
            uncertain?: number;
            truncated?: boolean;
          }
        | null;

      if (!res?.ok || !result?.success) {
        toast.error("Briefing non généré.", {
          description: result?.message ?? "Veuillez réessayer.",
        });
        return;
      }
      const toReview = (result.relevant ?? 0) + (result.uncertain ?? 0);
      // Truncated: the run stopped on a timestamp and the rest is still queued,
      // so the broker must know a second pass is needed — otherwise he closes
      // the page thinking his backlog is done.
      toast.success(
        toReview > 0
          ? `Briefing prêt — ${toReview} email${toReview > 1 ? "s" : ""} à traiter.`
          : "Briefing à jour — rien de neuf côté courtage.",
        result.truncated
          ? {
              description:
                "Il reste du retard à traiter : relancez pour continuer là où l’analyse s’est arrêtée.",
              duration: 8000,
            }
          : undefined,
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (variant === "ghost") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={generate}
        disabled={loading}
        className="inline-flex items-center gap-1.5"
      >
        <RefreshCw
          className={cn("size-3.5", loading && "animate-spin")}
          strokeWidth={1.75}
        />
        {loading ? "Analyse…" : "Actualiser"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={generate}
      disabled={loading}
      className="inline-flex items-center gap-2"
    >
      <MailSearch
        className={cn("size-4", loading && "animate-pulse")}
        strokeWidth={1.75}
      />
      {loading ? "Analyse de vos emails…" : label}
    </Button>
  );
}
