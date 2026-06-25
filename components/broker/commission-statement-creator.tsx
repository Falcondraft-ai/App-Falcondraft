"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function CommissionStatementCreator({
  insurers,
  canEdit,
}: {
  insurers: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    insurerName: "",
    periodLabel: "",
    periodStart: "",
    periodEnd: "",
    totalAmount: "",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((c) => ({ ...c, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.insurerName.trim()) {
      toast.error("La compagnie est requise.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/broker/commission-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insurerName: form.insurerName.trim(),
          periodLabel: form.periodLabel.trim() || null,
          periodStart: form.periodStart || null,
          periodEnd: form.periodEnd || null,
          totalAmount: toNumberOrNull(form.totalAmount),
        }),
      }).catch(() => null);

      const result = (await res?.json().catch(() => null)) as
        | { success?: boolean; statementId?: string; message?: string }
        | null;

      if (!res?.ok || !result?.success || !result.statementId) {
        toast.error("Bordereau non créé.", {
          description: result?.message ?? "Veuillez réessayer.",
        });
        return;
      }
      toast.success("Bordereau créé.");
      router.push(`/courtier/commissions/${result.statementId}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) return null;

  if (!open) {
    return (
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5"
      >
        <Plus className="size-3.5" strokeWidth={2.25} />
        Nouveau bordereau
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full rounded-lg border p-4"
      style={{ borderColor: "var(--border-1)", background: "var(--bg-sunken)" }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cs-insurer">Compagnie</Label>
          <Input
            id="cs-insurer"
            list="cs-insurer-list"
            value={form.insurerName}
            onChange={(e) => update("insurerName", e.target.value)}
            placeholder="Ex. AXA"
            disabled={saving}
          />
          {insurers.length > 0 ? (
            <datalist id="cs-insurer-list">
              {insurers.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-period">Période</Label>
          <Input
            id="cs-period"
            value={form.periodLabel}
            onChange={(e) => update("periodLabel", e.target.value)}
            placeholder="Ex. T1 2026 ou Janvier 2026"
            disabled={saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-start">Début de période</Label>
          <Input
            id="cs-start"
            type="date"
            value={form.periodStart}
            onChange={(e) => update("periodStart", e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-end">Fin de période</Label>
          <Input
            id="cs-end"
            type="date"
            value={form.periodEnd}
            onChange={(e) => update("periodEnd", e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-total">Montant total annoncé (€)</Label>
          <Input
            id="cs-total"
            inputMode="decimal"
            value={form.totalAmount}
            onChange={(e) => update("totalAmount", e.target.value)}
            placeholder="Ex. 4 250"
            disabled={saving}
          />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={saving}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Création…" : "Créer le bordereau"}
        </Button>
      </div>
    </form>
  );
}
