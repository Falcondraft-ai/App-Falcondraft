"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BrokerAdviceRow } from "@/types/database";

export function AdviceEditor({
  clientId,
  advice,
  canEdit,
  onValidated,
}: {
  clientId: string;
  advice: BrokerAdviceRow;
  canEdit: boolean;
  /** Called after a successful validation — the flow closes this step. */
  onValidated?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(advice.title);
  const [requirements, setRequirements] = React.useState(
    advice.requirements ?? "",
  );
  const [content, setContent] = React.useState(advice.content);
  const [saving, setSaving] = React.useState<
    "none" | "save" | "validate" | "regenerate"
  >("none");
  const isValidated = advice.status !== "draft";

  async function regenerate() {
    if (saving !== "none") return;
    if (
      !window.confirm(
        "Remplacer les exigences et les motifs actuels par une nouvelle proposition de l'assistant ?",
      )
    ) {
      return;
    }
    setSaving("regenerate");
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/advice/${advice.id}/motifs`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        motifs?: string;
        requirements?: string;
        message?: string;
      } | null;
      if (!res.ok || !data?.success) {
        toast.error("Régénération impossible", { description: data?.message });
        return;
      }
      if (data.requirements?.trim()) setRequirements(data.requirements);
      if (data.motifs?.trim()) setContent(data.motifs);
      toast.success("Nouvelle proposition prête.", {
        description: "Relisez-la puis validez le contenu.",
      });
    } finally {
      setSaving("none");
    }
  }

  async function submit(validate: boolean) {
    if (saving !== "none") return;
    setSaving(validate ? "validate" : "save");
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/advice/${advice.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, requirements, validate }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        toast.error(
          validate ? "Validation impossible" : "Enregistrement impossible",
          { description: data?.message },
        );
        return;
      }
      if (validate) {
        toast.success("Contenu validé.", {
          description: "Vous pouvez maintenant générer le document PDF.",
        });
        onValidated?.();
      } else {
        toast.success("Modifications enregistrées.");
      }
      router.refresh();
    } finally {
      setSaving("none");
    }
  }

  const disabled = !canEdit || saving !== "none";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit(false);
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="advice-title">Titre du document</Label>
        <Input
          id="advice-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="advice-requirements">
          Exigences en termes de garantie
        </Label>
        <Textarea
          id="advice-requirements"
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          rows={5}
          disabled={disabled}
          className="font-mono text-[12.5px] leading-6"
        />
        <p className="text-[11.5px] text-[var(--fg-3)]">
          Une puce « - » par exigence de garantie du client — générées à partir
          du devis, à relire.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="advice-content">
          Justification du conseil (motifs)
        </Label>
        <Textarea
          id="advice-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          disabled={disabled}
          className="font-mono text-[12.5px] leading-6"
        />
        <p className="text-[11.5px] text-[var(--fg-3)]">
          Une puce « - » par motif : en quoi la solution recommandée répond aux
          besoins du client. Le reste du PDF (identité, besoins, proposition,
          mentions légales) est rempli automatiquement.
        </p>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={saving !== "none"}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--fg-3)] transition-colors hover:text-[var(--fg-1)] disabled:opacity-50"
          >
            {saving === "regenerate" ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Sparkles className="size-3.5" strokeWidth={1.75} />
            )}
            {saving === "regenerate"
              ? "Nouvelle proposition…"
              : "Régénérer avec l'assistant"}
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="ghost" disabled={saving !== "none"}>
              {saving === "save" ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button
              type="button"
              onClick={() => void submit(true)}
              disabled={saving !== "none"}
              className="inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="size-3.5" strokeWidth={2} />
              {saving === "validate"
                ? "Validation…"
                : isValidated
                  ? "Enregistrer et revalider"
                  : "Valider le contenu"}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
