"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BrokerAdviceRow } from "@/types/database";

export function AdviceEditor({
  clientId,
  advice,
  canEdit,
  canDelete = false,
}: {
  clientId: string;
  advice: BrokerAdviceRow;
  canEdit: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(advice.title);
  const [content, setContent] = React.useState(advice.content);
  const [saving, setSaving] = React.useState<
    "none" | "save" | "validate" | "delete"
  >("none");
  const isValidated = advice.status === "validated";

  async function handleDelete() {
    if (saving !== "none") return;
    if (
      !window.confirm(
        "Supprimer définitivement ce devoir de conseil ? Cette action est irréversible.",
      )
    ) {
      return;
    }
    setSaving("delete");
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/advice/${advice.id}`,
        { method: "DELETE" },
      ).catch(() => null);
      if (!res?.ok) {
        toast.error("Suppression impossible.");
        return;
      }
      toast.success("Devoir de conseil supprimé.");
      router.push(`/courtier/clients/${clientId}`);
      router.refresh();
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
          body: JSON.stringify({ title, content, validate }),
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
      toast.success(validate ? "Devoir de conseil validé." : "Enregistré.");
      if (validate) {
        router.push(`/courtier/clients/${clientId}`);
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
        <Label htmlFor="advice-content">Contenu</Label>
        <Textarea
          id="advice-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={22}
          disabled={disabled}
          className="font-mono text-[12.5px] leading-6"
        />
        <p className="text-[11.5px] text-[var(--fg-3)]">
          Le document reste entièrement modifiable. Relisez et complétez chaque
          section avant de valider.
        </p>
      </div>

      {canEdit || canDelete ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={saving !== "none"}
              className="inline-flex items-center gap-1.5 text-[var(--destructive)] hover:text-[var(--destructive)]"
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
              {saving === "delete" ? "Suppression…" : "Supprimer"}
            </Button>
          ) : (
            <span />
          )}
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                variant="ghost"
                disabled={saving !== "none"}
              >
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
                    : "Valider le devoir de conseil"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
