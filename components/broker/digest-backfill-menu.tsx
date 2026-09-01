"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { ChevronDown, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [7, 14, 30, 90] as const;

/**
 * "Go back over the last N days" — runs the Outlook briefing over a wider window
 * to catch up on emails that were never analysed (e.g. before connecting the
 * mailbox, or ones set aside). Already-processed emails are skipped server-side,
 * so nothing is duplicated.
 */
export function DigestBackfillMenu() {
  const router = useRouter();
  const [loading, setLoading] = React.useState<number | null>(null);
  const busy = loading !== null;

  async function run(days: number) {
    if (busy) return;
    setLoading(days);
    try {
      const res = await fetch("/api/courtier/outlook/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windowDays: days }),
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
        toast.error("Analyse non effectuée.", {
          description: result?.message ?? "Veuillez réessayer.",
        });
        return;
      }
      const toReview = (result.relevant ?? 0) + (result.uncertain ?? 0);
      toast.success(
        toReview > 0
          ? `${toReview} email${toReview > 1 ? "s" : ""} à traiter sur ${days} jours.`
          : `Rien de non traité sur les ${days} derniers jours.`,
        result.truncated
          ? {
              description:
                "Le volume dépasse une seule analyse : relancez pour traiter la suite.",
              duration: 8000,
            }
          : undefined,
      );
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          className="inline-flex items-center gap-1.5"
          title="Analyser les emails plus anciens non encore traités"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
          ) : (
            <History className="size-3.5" strokeWidth={1.75} />
          )}
          {busy ? "Analyse…" : "Remonter"}
          <ChevronDown className="size-3.5 opacity-70" strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((days) => (
          <DropdownMenuItem
            key={days}
            disabled={busy}
            onSelect={(e) => {
              e.preventDefault();
              void run(days);
            }}
          >
            Analyser les {days} derniers jours
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
