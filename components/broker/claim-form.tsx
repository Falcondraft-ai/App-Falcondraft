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
  brokerClaimStatusLabels,
  brokerClaimStatuses,
  commonClaimTypes,
} from "@/lib/broker/claims";
import type { BrokerClaimRow } from "@/types/database";

export type ClaimContractOption = { id: string; label: string };

const NO_CONTRACT = "__none__";

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function ClaimForm({
  clientId,
  claim,
  contracts,
  canEdit,
  mode,
  onCreated,
  onCancel,
}: {
  clientId: string;
  claim?: BrokerClaimRow;
  contracts: ClaimContractOption[];
  canEdit: boolean;
  mode: "create" | "edit";
  onCreated?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState<"none" | "save" | "delete">("none");
  const [form, setForm] = React.useState({
    claimType: claim?.claim_type ?? "",
    insurerName: claim?.insurer_name ?? "",
    reference: claim?.reference ?? "",
    contractId: claim?.contract_id ?? "",
    status: claim?.status ?? "declared",
    occurrenceDate: claim?.occurrence_date ?? "",
    declarationDate: claim?.declaration_date ?? "",
    amountEstimate:
      claim?.amount_estimate != null ? String(claim.amount_estimate) : "",
    amountSettled:
      claim?.amount_settled != null ? String(claim.amount_settled) : "",
    description: claim?.description ?? "",
    notes: claim?.notes ?? "",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((c) => ({ ...c, [key]: value }));
  }

  function buildPayload() {
    return {
      claimType: form.claimType.trim() || null,
      insurerName: form.insurerName.trim() || null,
      reference: form.reference.trim() || null,
      contractId: form.contractId || null,
      status: form.status,
      occurrenceDate: form.occurrenceDate || null,
      declarationDate: form.declarationDate || null,
      amountEstimate: toNumberOrNull(form.amountEstimate),
      amountSettled: toNumberOrNull(form.amountSettled),
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
    };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving !== "none" || !canEdit) return;
    if (!form.claimType.trim()) {
      toast.error("Le type de sinistre est requis.");
      return;
    }
    setSaving("save");
    try {
      const url =
        mode === "edit" && claim
          ? `/api/broker/clients/${clientId}/claims/${claim.id}`
          : `/api/broker/clients/${clientId}/claims`;
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
          mode === "edit" ? "Modification impossible." : "Sinistre non créé.",
          { description: result?.message ?? "Veuillez réessayer." },
        );
        return;
      }
      toast.success(
        mode === "edit" ? "Sinistre enregistré." : "Sinistre déclaré.",
      );
      if (mode === "create") onCreated?.();
      router.refresh();
    } finally {
      setSaving("none");
    }
  }

  async function handleDelete() {
    if (!claim || saving !== "none") return;
    if (!window.confirm("Supprimer définitivement ce sinistre ?")) return;
    setSaving("delete");
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/claims/${claim.id}`,
        { method: "DELETE" },
      ).catch(() => null);
      if (!res?.ok) {
        toast.error("Suppression impossible.");
        return;
      }
      toast.success("Sinistre supprimé.");
      router.push(`/courtier/clients/${clientId}`);
      router.refresh();
    } finally {
      setSaving("none");
    }
  }

  const disabled = !canEdit || saving !== "none";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cm-type">Nature du sinistre</Label>
          <Input
            id="cm-type"
            list="cm-type-list"
            value={form.claimType}
            onChange={(e) => update("claimType", e.target.value)}
            placeholder="Ex. Dégât des eaux"
            disabled={disabled}
          />
          <datalist id="cm-type-list">
            {commonClaimTypes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cm-ref">N° de sinistre (compagnie)</Label>
          <Input
            id="cm-ref"
            value={form.reference}
            onChange={(e) => update("reference", e.target.value)}
            placeholder="Référence communiquée par l’assureur"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cm-insurer">Compagnie</Label>
          <Input
            id="cm-insurer"
            value={form.insurerName}
            onChange={(e) => update("insurerName", e.target.value)}
            placeholder="Ex. AXA"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Contrat concerné</Label>
          <Select
            value={form.contractId || NO_CONTRACT}
            onValueChange={(v) =>
              update("contractId", v === NO_CONTRACT ? "" : v)
            }
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Aucun contrat lié" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CONTRACT}>Aucun contrat lié</SelectItem>
              {contracts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cm-occurrence">Date du sinistre</Label>
          <Input
            id="cm-occurrence"
            type="date"
            value={form.occurrenceDate}
            onChange={(e) => update("occurrenceDate", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cm-declaration">Date de déclaration</Label>
          <Input
            id="cm-declaration"
            type="date"
            value={form.declarationDate}
            onChange={(e) => update("declarationDate", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Statut</Label>
          <Select
            value={form.status}
            onValueChange={(v) => update("status", v)}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {brokerClaimStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {brokerClaimStatusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cm-estimate">Montant estimé (€)</Label>
          <Input
            id="cm-estimate"
            inputMode="decimal"
            value={form.amountEstimate}
            onChange={(e) => update("amountEstimate", e.target.value)}
            placeholder="Ex. 2 500"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cm-settled">Montant indemnisé (€)</Label>
          <Input
            id="cm-settled"
            inputMode="decimal"
            value={form.amountSettled}
            onChange={(e) => update("amountSettled", e.target.value)}
            placeholder="Une fois l’indemnisation connue"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cm-description">Description</Label>
        <Textarea
          id="cm-description"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Circonstances du sinistre, dommages constatés…"
          rows={3}
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cm-notes">Notes de suivi</Label>
        <Textarea
          id="cm-notes"
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Échanges avec la compagnie, pièces à fournir, relances…"
          rows={2}
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
                  : "Déclarer le sinistre"}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
