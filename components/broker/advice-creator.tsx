"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { FilePlus2, Loader2, PenLine } from "lucide-react";

type CreateResponse =
  | { success: true; adviceId: string }
  | { success: false; message?: string };

export function AdviceCreator({
  clientId,
  hasValidatedQuote,
  canEdit,
}: {
  clientId: string;
  hasValidatedQuote: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"none" | "template" | "blank">("none");

  if (!canEdit) return null;

  async function create(mode: "template" | "blank") {
    if (busy !== "none") return;
    setBusy(mode);
    try {
      const res = await fetch(`/api/broker/clients/${clientId}/advice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = (await res.json().catch(() => null)) as CreateResponse | null;
      if (!res.ok || !data?.success) {
        toast.error("Création impossible", {
          description: (data && "message" in data && data.message) || undefined,
        });
        return;
      }
      toast.success(
        mode === "template"
          ? "Devoir de conseil généré — à compléter et valider."
          : "Document créé.",
      );
      router.push(`/courtier/clients/${clientId}/advice/${data.adviceId}`);
      router.refresh();
    } finally {
      setBusy("none");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={() => create("template")}
        disabled={busy !== "none"}
        className="inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-60"
        style={{
          background: "var(--brand-navy-800)",
          color: "#FFFFFF",
          border: "1px solid var(--brand-navy-800)",
        }}
      >
        {busy === "template" ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <PenLine className="size-3.5" strokeWidth={2} />
        )}
        Générer le devoir de conseil
      </button>

      <button
        type="button"
        onClick={() => create("blank")}
        disabled={busy !== "none"}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors disabled:opacity-60"
        style={{
          borderColor: "var(--border-1)",
          background: "var(--bg-surface)",
          color: "var(--fg-2)",
        }}
      >
        <FilePlus2 className="size-3.5" strokeWidth={2} />
        Document vierge
      </button>

      {!hasValidatedQuote ? (
        <p className="w-full text-[11.5px] text-[var(--fg-3)]">
          Astuce : validez un devis compagnie pour pré-remplir la solution
          recommandée.
        </p>
      ) : null}
    </div>
  );
}
