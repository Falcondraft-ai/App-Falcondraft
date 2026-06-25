"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { insuranceTypeLabel } from "@/lib/broker/clients";
import {
  countAnsweredNeeds,
  getNeedsQuestions,
  normalizeNeedsData,
  type NeedsQuestion,
} from "@/lib/broker/needs";
import { cn } from "@/lib/utils";

const NO_VALUE = "__none__";

export function NeedsQuestionnaire({
  clientId,
  branch,
  initialData,
  initialNeeds,
  canEdit,
}: {
  clientId: string;
  branch: string | null;
  initialData: Record<string, unknown>;
  initialNeeds: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const questions = getNeedsQuestions(branch);
  const [answers, setAnswers] = React.useState<Record<string, string>>(
    normalizeNeedsData(initialData),
  );
  const [needs, setNeeds] = React.useState(initialNeeds ?? "");
  const [saving, setSaving] = React.useState(false);

  function set(id: string, value: string) {
    setAnswers((current) => {
      const next = { ...current };
      if (value === "") delete next[id];
      else next[id] = value;
      return next;
    });
  }

  const progress = countAnsweredNeeds(branch, answers);

  async function save() {
    if (saving || !canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/broker/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredNeeds: answers,
          needs: needs.trim() || null,
        }),
      }).catch(() => null);

      const result = (await res?.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;

      if (!res?.ok || !result?.success) {
        toast.error("Enregistrement impossible.", {
          description: result?.message ?? "Veuillez réessayer.",
        });
        return;
      }
      toast.success("Recueil de besoins enregistré.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function renderField(question: NeedsQuestion) {
    const value = answers[question.id] ?? "";
    const disabled = !canEdit || saving;

    if (question.type === "select") {
      return (
        <Select
          value={value || NO_VALUE}
          onValueChange={(v) => set(question.id, v === NO_VALUE ? "" : v)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sélectionner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_VALUE}>Non précisé</SelectItem>
            {question.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (question.type === "boolean") {
      return (
        <div className="grid grid-cols-2 gap-3 sm:max-w-[220px]">
          {["Oui", "Non"].map((opt) => {
            const active = value === opt;
            return (
              <button
                key={opt}
                type="button"
                disabled={disabled}
                onClick={() => set(question.id, active ? "" : opt)}
                className={cn(
                  "rounded-md border px-4 py-2 text-[13px] font-medium transition-colors",
                )}
                style={
                  active
                    ? {
                        borderColor: "var(--brand-navy-700)",
                        background: "var(--brand-navy-50)",
                        color: "var(--brand-navy-800)",
                      }
                    : {
                        borderColor: "var(--border-1)",
                        background: "var(--bg-surface)",
                        color: "var(--fg-2)",
                      }
                }
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    }

    if (question.type === "textarea") {
      return (
        <Textarea
          value={value}
          onChange={(e) => set(question.id, e.target.value)}
          placeholder={question.placeholder}
          rows={2}
          disabled={disabled}
        />
      );
    }

    return (
      <div className="relative">
        <Input
          inputMode={question.type === "number" ? "decimal" : undefined}
          value={value}
          onChange={(e) => set(question.id, e.target.value)}
          placeholder={question.placeholder}
          disabled={disabled}
          className={question.unit ? "pr-12" : undefined}
        />
        {question.unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-[var(--fg-3)]">
            {question.unit}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-[var(--fg-3)]">
          Questionnaire{" "}
          <span className="font-medium text-[var(--fg-2)]">
            {branch ? insuranceTypeLabel(branch) : "général"}
          </span>{" "}
          — ces réponses alimentent le devoir de conseil.
        </p>
        <span
          className="rounded-full border px-2.5 py-[3px] text-[11px] font-semibold"
          style={{
            color:
              progress.answered === progress.total
                ? "var(--success, #15803d)"
                : "var(--fg-3)",
            background:
              progress.answered === progress.total
                ? "var(--success-soft, #f0fdf4)"
                : "var(--bg-sunken)",
            borderColor: "var(--border-1)",
          }}
        >
          {progress.answered}/{progress.total} renseigné
          {progress.total > 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {questions.map((question) => (
          <div
            key={question.id}
            className={
              question.type === "textarea" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"
            }
          >
            <Label>{question.label}</Label>
            {renderField(question)}
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="needs-complements">Compléments (texte libre)</Label>
        <Textarea
          id="needs-complements"
          value={needs}
          onChange={(e) => setNeeds(e.target.value)}
          placeholder="Précisions, contexte, attentes particulières du client…"
          rows={3}
          disabled={!canEdit || saving}
        />
      </div>

      {canEdit ? (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5"
          >
            <Check className="size-3.5" strokeWidth={2} />
            {saving ? "Enregistrement…" : "Enregistrer le recueil"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
