"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BrokerQuoteRow } from "@/types/database";

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function QuoteValidationForm({
  clientId,
  quote,
  canEdit,
  canDelete = false,
}: {
  clientId: string;
  quote: BrokerQuoteRow;
  canEdit: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState<
    "none" | "save" | "validate" | "delete"
  >("none");

  async function handleDelete() {
    if (saving !== "none") return;
    if (
      !window.confirm(
        "Supprimer définitivement ce devis ? Cette action est irréversible.",
      )
    ) {
      return;
    }
    setSaving("delete");
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/quotes/${quote.id}`,
        { method: "DELETE" },
      ).catch(() => null);
      if (!res?.ok) {
        toast.error("Suppression impossible.");
        return;
      }
      toast.success("Devis supprimé.");
      router.push(`/courtier/clients/${clientId}`);
      router.refresh();
    } finally {
      setSaving("none");
    }
  }
  const [form, setForm] = React.useState({
    insurerName: quote.insurer_name ?? "",
    productName: quote.product_name ?? "",
    premiumMonthly:
      quote.premium_monthly !== null ? String(quote.premium_monthly) : "",
    premiumAnnual:
      quote.premium_annual !== null ? String(quote.premium_annual) : "",
    currency: quote.currency ?? "EUR",
    coverageSummary: quote.coverage_summary ?? "",
    deductible: quote.deductible ?? "",
    notes: quote.notes ?? "",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(validate: boolean) {
    if (saving !== "none") return;
    setSaving(validate ? "validate" : "save");
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/quotes/${quote.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            insurerName: form.insurerName || null,
            productName: form.productName || null,
            premiumMonthly: toNumberOrNull(form.premiumMonthly),
            premiumAnnual: toNumberOrNull(form.premiumAnnual),
            currency: form.currency || "EUR",
            coverageSummary: form.coverageSummary || null,
            deductible: form.deductible || null,
            notes: form.notes || null,
            validate,
          }),
        },
      );
      if (!res.ok) {
        toast.error(
          validate ? "Validation impossible." : "Enregistrement impossible.",
        );
        return;
      }
      toast.success(validate ? "Devis validé." : "Modifications enregistrées.");
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
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="insurerName">Compagnie / Assureur</Label>
          <Input
            id="insurerName"
            value={form.insurerName}
            onChange={(e) => update("insurerName", e.target.value)}
            placeholder="Ex. AXA, Generali…"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="productName">Produit / Formule</Label>
          <Input
            id="productName"
            value={form.productName}
            onChange={(e) => update("productName", e.target.value)}
            placeholder="Ex. Multirisque Pro Confort"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="premiumMonthly">Prime mensuelle</Label>
          <Input
            id="premiumMonthly"
            inputMode="decimal"
            value={form.premiumMonthly}
            onChange={(e) => update("premiumMonthly", e.target.value)}
            placeholder="49,90"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="premiumAnnual">Prime annuelle</Label>
          <Input
            id="premiumAnnual"
            inputMode="decimal"
            value={form.premiumAnnual}
            onChange={(e) => update("premiumAnnual", e.target.value)}
            placeholder="598,80"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">Devise</Label>
          <Input
            id="currency"
            value={form.currency}
            onChange={(e) => update("currency", e.target.value.toUpperCase())}
            placeholder="EUR"
            maxLength={8}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="coverageSummary">Garanties principales</Label>
        <Textarea
          id="coverageSummary"
          value={form.coverageSummary}
          onChange={(e) => update("coverageSummary", e.target.value)}
          placeholder="Résumé des garanties, plafonds, options incluses…"
          rows={4}
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deductible">Franchise</Label>
        <Input
          id="deductible"
          value={form.deductible}
          onChange={(e) => update("deductible", e.target.value)}
          placeholder="Ex. 150 € par sinistre"
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Remarques internes sur ce devis."
          rows={3}
          disabled={disabled}
        />
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
                {saving === "validate" ? "Validation…" : "Valider le devis"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
