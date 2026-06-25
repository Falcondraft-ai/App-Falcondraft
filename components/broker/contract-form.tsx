"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import {
  brokerInsuranceTypeLabels,
  type BrokerInsuranceType,
} from "@/lib/broker/clients";
import {
  brokerContractStatusLabels,
  brokerContractStatuses,
  brokerPremiumFrequencyLabels,
  brokerPremiumFrequencies,
} from "@/lib/broker/contracts";
import { cn } from "@/lib/utils";
import type { BrokerContractRow } from "@/types/database";

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const NO_BRANCH = "__none__";

export function ContractForm({
  clientId,
  contract,
  branches,
  insurers,
  canEdit,
  mode,
  onCreated,
  onCancel,
}: {
  clientId: string;
  contract?: BrokerContractRow;
  branches: BrokerInsuranceType[];
  insurers: string[];
  canEdit: boolean;
  mode: "create" | "edit";
  onCreated?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState<"none" | "save" | "delete">("none");
  const [form, setForm] = React.useState({
    insurerName: contract?.insurer_name ?? "",
    productName: contract?.product_name ?? "",
    insuranceType: contract?.insurance_type ?? "",
    policyNumber: contract?.policy_number ?? "",
    status: contract?.status ?? "active",
    effectiveDate: contract?.effective_date ?? "",
    renewalDate: contract?.renewal_date ?? "",
    premiumAmount:
      contract?.premium_amount !== null && contract?.premium_amount !== undefined
        ? String(contract.premium_amount)
        : "",
    premiumFrequency: contract?.premium_frequency ?? "annual",
    currency: contract?.currency ?? "EUR",
    tacitRenewal: contract?.tacit_renewal ?? true,
    commissionRate:
      contract?.commission_rate !== null &&
      contract?.commission_rate !== undefined
        ? String(contract.commission_rate)
        : "",
    notes: contract?.notes ?? "",
  });

  function update<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildPayload() {
    return {
      insurerName: form.insurerName.trim() || null,
      productName: form.productName.trim() || null,
      insuranceType: form.insuranceType || null,
      policyNumber: form.policyNumber.trim() || null,
      status: form.status,
      effectiveDate: form.effectiveDate || null,
      renewalDate: form.renewalDate || null,
      premiumAmount: toNumberOrNull(form.premiumAmount),
      premiumFrequency: form.premiumFrequency,
      currency: form.currency.trim() || "EUR",
      tacitRenewal: form.tacitRenewal,
      commissionRate: toNumberOrNull(form.commissionRate),
      notes: form.notes.trim() || null,
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving !== "none" || !canEdit) return;

    if (!form.insurerName.trim()) {
      toast.error("La compagnie est requise.");
      return;
    }

    setSaving("save");
    try {
      const url =
        mode === "edit" && contract
          ? `/api/broker/clients/${clientId}/contracts/${contract.id}`
          : `/api/broker/clients/${clientId}/contracts`;
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      }).catch(() => null);

      const result = (await res?.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;

      if (!res?.ok || !result?.success) {
        toast.error(
          mode === "edit" ? "Modification impossible." : "Contrat non créé.",
          { description: result?.message ?? "Veuillez réessayer." },
        );
        return;
      }

      toast.success(mode === "edit" ? "Contrat enregistré." : "Contrat ajouté.");
      if (mode === "create") {
        setForm((c) => ({
          ...c,
          insurerName: "",
          productName: "",
          policyNumber: "",
          effectiveDate: "",
          renewalDate: "",
          premiumAmount: "",
          commissionRate: "",
          notes: "",
        }));
        onCreated?.();
      }
      router.refresh();
    } finally {
      setSaving("none");
    }
  }

  async function handleDelete() {
    if (!contract || saving !== "none") return;
    if (
      !window.confirm(
        "Supprimer définitivement ce contrat ? Cette action est irréversible.",
      )
    ) {
      return;
    }
    setSaving("delete");
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/contracts/${contract.id}`,
        { method: "DELETE" },
      ).catch(() => null);
      if (!res?.ok) {
        toast.error("Suppression impossible.");
        return;
      }
      toast.success("Contrat supprimé.");
      router.push(`/courtier/clients/${clientId}`);
      router.refresh();
    } finally {
      setSaving("none");
    }
  }

  const disabled = !canEdit || saving !== "none";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ct-insurer">Compagnie / Assureur</Label>
          <Input
            id="ct-insurer"
            list="ct-insurer-list"
            value={form.insurerName}
            onChange={(e) => update("insurerName", e.target.value)}
            placeholder="Ex. AXA, Generali…"
            disabled={disabled}
          />
          {insurers.length > 0 ? (
            <datalist id="ct-insurer-list">
              {insurers.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ct-product">Produit / Formule</Label>
          <Input
            id="ct-product"
            value={form.productName}
            onChange={(e) => update("productName", e.target.value)}
            placeholder="Ex. Multirisque Habitation Confort"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Branche</Label>
          <Select
            value={form.insuranceType || NO_BRANCH}
            onValueChange={(value) =>
              update("insuranceType", value === NO_BRANCH ? "" : value)
            }
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sélectionner une branche" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_BRANCH}>Non précisée</SelectItem>
              {branches.map((type) => (
                <SelectItem key={type} value={type}>
                  {brokerInsuranceTypeLabels[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ct-policy">N° de contrat / police</Label>
          <Input
            id="ct-policy"
            value={form.policyNumber}
            onChange={(e) => update("policyNumber", e.target.value)}
            placeholder="Ex. 0012345678"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ct-effective">Date d’effet</Label>
          <Input
            id="ct-effective"
            type="date"
            value={form.effectiveDate}
            onChange={(e) => update("effectiveDate", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ct-renewal">Date d’échéance</Label>
          <Input
            id="ct-renewal"
            type="date"
            value={form.renewalDate}
            onChange={(e) => update("renewalDate", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Statut</Label>
          <Select
            value={form.status}
            onValueChange={(value) => update("status", value)}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {brokerContractStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {brokerContractStatusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ct-premium">Prime</Label>
          <Input
            id="ct-premium"
            inputMode="decimal"
            value={form.premiumAmount}
            onChange={(e) => update("premiumAmount", e.target.value)}
            placeholder="49,90"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Périodicité</Label>
          <Select
            value={form.premiumFrequency}
            onValueChange={(value) => update("premiumFrequency", value)}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {brokerPremiumFrequencies.map((f) => (
                <SelectItem key={f} value={f}>
                  {brokerPremiumFrequencyLabels[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ct-commission">Taux de commission (%)</Label>
          <Input
            id="ct-commission"
            inputMode="decimal"
            value={form.commissionRate}
            onChange={(e) => update("commissionRate", e.target.value)}
            placeholder="Ex. 10"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Tacite reconduction</Label>
        <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
          {(
            [
              { key: true, label: "Oui" },
              { key: false, label: "Non" },
            ] as { key: boolean; label: string }[]
          ).map((option) => {
            const active = form.tacitRenewal === option.key;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => update("tacitRenewal", option.key)}
                disabled={disabled}
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
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ct-notes">Notes</Label>
        <Textarea
          id="ct-notes"
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Garanties clés, options, remarques internes sur ce contrat."
          rows={3}
          disabled={disabled}
        />
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {mode === "edit" ? (
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
          <div className="flex items-center gap-3">
            {mode === "create" && onCancel ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={saving !== "none"}
              >
                Annuler
              </Button>
            ) : null}
            <Button type="submit" disabled={saving !== "none"}>
              {saving === "save"
                ? "Enregistrement…"
                : mode === "edit"
                  ? "Enregistrer"
                  : "Ajouter le contrat"}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
