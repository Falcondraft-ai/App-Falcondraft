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
import {
  brokerCommissionStatusLabels,
  brokerCommissionStatuses,
} from "@/lib/broker/commissions";
import type { BrokerCommissionRow } from "@/types/database";

export type LineClientOption = { id: string; name: string };
export type LineContractOption = {
  id: string;
  clientId: string;
  label: string;
};

const NO_CLIENT = "__none__";
const NO_CONTRACT = "__none__";

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function CommissionLineForm({
  statementId,
  commission,
  clients,
  contracts,
  mode,
  onDone,
  onCancel,
}: {
  statementId?: string;
  commission?: BrokerCommissionRow;
  clients: LineClientOption[];
  contracts: LineContractOption[];
  mode: "create" | "edit";
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState<"none" | "save" | "delete">("none");
  const [form, setForm] = React.useState({
    clientId: commission?.client_id ?? "",
    contractId: commission?.contract_id ?? "",
    insurerName: commission?.insurer_name ?? "",
    label: commission?.label ?? "",
    baseAmount:
      commission?.base_amount != null ? String(commission.base_amount) : "",
    rate: commission?.rate != null ? String(commission.rate) : "",
    commissionAmount:
      commission?.commission_amount != null
        ? String(commission.commission_amount)
        : "",
    retrocessionBeneficiary: commission?.retrocession_beneficiary ?? "",
    retrocessionAmount:
      commission?.retrocession_amount != null
        ? String(commission.retrocession_amount)
        : "",
    status: commission?.status ?? "expected",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((c) => ({ ...c, [key]: value }));
  }

  const contractOptions = form.clientId
    ? contracts.filter((c) => c.clientId === form.clientId)
    : [];

  function buildPayload() {
    return {
      statementId,
      clientId: form.clientId || null,
      contractId: form.contractId || null,
      insurerName: form.insurerName.trim() || null,
      label: form.label.trim() || null,
      baseAmount: toNumberOrNull(form.baseAmount),
      rate: toNumberOrNull(form.rate),
      commissionAmount: toNumberOrNull(form.commissionAmount),
      retrocessionAmount: toNumberOrNull(form.retrocessionAmount),
      retrocessionBeneficiary: form.retrocessionBeneficiary.trim() || null,
      status: form.status,
    };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving !== "none") return;
    setSaving("save");
    try {
      const url =
        mode === "edit" && commission
          ? `/api/broker/commissions/${commission.id}`
          : "/api/broker/commissions";
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
          mode === "edit" ? "Modification impossible." : "Commission non créée.",
          { description: result?.message ?? "Veuillez réessayer." },
        );
        return;
      }
      toast.success(mode === "edit" ? "Commission enregistrée." : "Commission ajoutée.");
      onDone?.();
      router.refresh();
    } finally {
      setSaving("none");
    }
  }

  async function handleDelete() {
    if (!commission || saving !== "none") return;
    if (!window.confirm("Supprimer cette ligne de commission ?")) return;
    setSaving("delete");
    try {
      const res = await fetch(`/api/broker/commissions/${commission.id}`, {
        method: "DELETE",
      }).catch(() => null);
      if (!res?.ok) {
        toast.error("Suppression impossible.");
        return;
      }
      toast.success("Commission supprimée.");
      onDone?.();
      router.refresh();
    } finally {
      setSaving("none");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cl-label">Libellé</Label>
          <Input
            id="cl-label"
            value={form.label}
            onChange={(e) => update("label", e.target.value)}
            placeholder="Ex. Commission MRH 2026"
            disabled={saving !== "none"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cl-insurer">Compagnie</Label>
          <Input
            id="cl-insurer"
            value={form.insurerName}
            onChange={(e) => update("insurerName", e.target.value)}
            placeholder="Ex. AXA"
            disabled={saving !== "none"}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cl-base">Assiette / prime (€)</Label>
          <Input
            id="cl-base"
            inputMode="decimal"
            value={form.baseAmount}
            onChange={(e) => update("baseAmount", e.target.value)}
            placeholder="600"
            disabled={saving !== "none"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cl-rate">Taux (%)</Label>
          <Input
            id="cl-rate"
            inputMode="decimal"
            value={form.rate}
            onChange={(e) => update("rate", e.target.value)}
            placeholder="10"
            disabled={saving !== "none"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cl-commission">Commission perçue (€)</Label>
          <Input
            id="cl-commission"
            inputMode="decimal"
            value={form.commissionAmount}
            onChange={(e) => update("commissionAmount", e.target.value)}
            placeholder="60"
            disabled={saving !== "none"}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cl-retro-benef">
            Apporteur (rétrocession)
          </Label>
          <Input
            id="cl-retro-benef"
            value={form.retrocessionBeneficiary}
            onChange={(e) => update("retrocessionBeneficiary", e.target.value)}
            placeholder="Nom de l’apporteur (optionnel)"
            disabled={saving !== "none"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cl-retro-amount">Montant rétrocédé (€)</Label>
          <Input
            id="cl-retro-amount"
            inputMode="decimal"
            value={form.retrocessionAmount}
            onChange={(e) => update("retrocessionAmount", e.target.value)}
            placeholder="0"
            disabled={saving !== "none"}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Dossier client</Label>
          <Select
            value={form.clientId || NO_CLIENT}
            onValueChange={(value) => {
              const next = value === NO_CLIENT ? "" : value;
              setForm((c) => ({ ...c, clientId: next, contractId: "" }));
            }}
            disabled={saving !== "none"}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Aucun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CLIENT}>Aucun</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Contrat</Label>
          <Select
            value={form.contractId || NO_CONTRACT}
            onValueChange={(value) =>
              update("contractId", value === NO_CONTRACT ? "" : value)
            }
            disabled={saving !== "none" || !form.clientId}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={form.clientId ? "Aucun" : "Choisir un dossier"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CONTRACT}>Aucun</SelectItem>
              {contractOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Statut</Label>
          <Select
            value={form.status}
            onValueChange={(value) => update("status", value)}
            disabled={saving !== "none"}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {brokerCommissionStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {brokerCommissionStatusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
          {onCancel ? (
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
                : "Ajouter la ligne"}
          </Button>
        </div>
      </div>
    </form>
  );
}
