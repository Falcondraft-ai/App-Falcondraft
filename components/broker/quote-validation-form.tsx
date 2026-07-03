"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";
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

type ExtractedQuote = {
  insurer_name: string | null;
  product_name: string | null;
  premium_monthly: number | null;
  premium_annual: number | null;
  currency: string | null;
  coverage_summary: string | null;
  deductible: string | null;
  vigilance_points: string | null;
  other_info: string | null;
};

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
  const [extracting, setExtracting] = React.useState(
    quote.extraction_status === "pending" &&
      Boolean(quote.document_id) &&
      canEdit,
  );
  const extractionStarted = React.useRef(false);

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
    vigilancePoints: quote.vigilance_points ?? "",
    otherInfo: quote.other_info ?? "",
    notes: quote.notes ?? "",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  // Auto-extract a freshly imported quote (PDF/image) to pre-fill the form.
  React.useEffect(() => {
    if (extractionStarted.current) return;
    if (
      quote.extraction_status !== "pending" ||
      !quote.document_id ||
      !canEdit
    ) {
      return;
    }
    extractionStarted.current = true;
    void (async () => {
      try {
        const res = await fetch(
          `/api/broker/clients/${clientId}/quotes/${quote.id}/extract`,
          { method: "POST" },
        );
        const payload = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: ExtractedQuote;
          message?: string;
        } | null;
        if (!res.ok || !payload?.success) {
          toast.info(
            "Lecture automatique indisponible — saisissez les informations.",
            { description: payload?.message },
          );
          return;
        }
        const d = payload.data;
        if (d) {
          setForm((current) => ({
            ...current,
            insurerName: d.insurer_name ?? current.insurerName,
            productName: d.product_name ?? current.productName,
            premiumMonthly:
              d.premium_monthly != null
                ? String(d.premium_monthly)
                : current.premiumMonthly,
            premiumAnnual:
              d.premium_annual != null
                ? String(d.premium_annual)
                : current.premiumAnnual,
            currency: d.currency ?? current.currency,
            coverageSummary: d.coverage_summary ?? current.coverageSummary,
            deductible: d.deductible ?? current.deductible,
            vigilancePoints: d.vigilance_points ?? current.vigilancePoints,
            otherInfo: d.other_info ?? current.otherInfo,
          }));
          toast.success("Devis lu automatiquement — vérifiez puis validez.");
          router.refresh();
        }
      } finally {
        setExtracting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            vigilancePoints: form.vigilancePoints || null,
            otherInfo: form.otherInfo || null,
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
      toast.success("Devis enregistré.");
      if (validate) {
        router.push(`/courtier/clients/${clientId}`);
      }
      router.refresh();
    } finally {
      setSaving("none");
    }
  }

  const disabled = !canEdit || saving !== "none" || extracting;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit(true);
      }}
      className="space-y-5"
    >
      {extracting ? (
        <div
          className="flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-[12.5px]"
          style={{
            borderColor: "var(--brand-amber-200, rgba(184,146,42,0.25))",
            background: "var(--brand-amber-50, #fdf7e8)",
            color: "var(--brand-amber-800, #92610f)",
          }}
        >
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
          Lecture automatique du devis en cours…
        </div>
      ) : null}

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
        <Label htmlFor="vigilancePoints">
          Exclusions et points de vigilance
        </Label>
        <Textarea
          id="vigilancePoints"
          value={form.vigilancePoints}
          onChange={(e) => update("vigilancePoints", e.target.value)}
          placeholder="Exclusions, délais de carence, conditions à signaler au client…"
          rows={3}
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="otherInfo">Autres informations</Label>
        <Textarea
          id="otherInfo"
          value={form.otherInfo}
          onChange={(e) => update("otherInfo", e.target.value)}
          placeholder="Durée d'engagement, date d'effet, assistance, services inclus…"
          rows={3}
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
            <Button
              type="submit"
              disabled={saving !== "none"}
              className="inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="size-3.5" strokeWidth={2} />
              {saving !== "none" ? "Enregistrement…" : "Enregistrer"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
