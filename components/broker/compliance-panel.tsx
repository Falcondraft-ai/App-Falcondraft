"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Check, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { documentCategoryLabel } from "@/lib/broker/documents";
import {
  brokerRiskLevels,
  brokerRiskLevelLabels,
  complianceLevel,
  complianceLevelLabels,
  complianceLevelTone,
  computeComplianceStatus,
} from "@/lib/broker/compliance";
import type {
  BrokerComplianceRow,
  BrokerDocumentRow,
} from "@/types/database";

const NO_RISK = "__none__";
const NO_DOC = "__none__";

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md border px-3.5 py-3"
      style={{
        borderColor: "var(--border-1)",
        background: checked ? "var(--brand-navy-50)" : "var(--bg-surface)",
      }}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--fg-1)]">{label}</p>
        {description ? (
          <p className="mt-0.5 text-[11.5px] leading-4 text-[var(--fg-3)]">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
        style={{
          background: checked
            ? "var(--brand-navy-800)"
            : "var(--border-strong, #d4d0c8)",
        }}
      >
        <span
          className="inline-block size-4 rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: checked ? "translateX(22px)" : "translateX(3px)" }}
        />
      </button>
    </div>
  );
}

export function CompliancePanel({
  clientId,
  compliance,
  documents,
  canEdit,
}: {
  clientId: string;
  compliance: BrokerComplianceRow | null;
  documents: BrokerDocumentRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    infoSheetDelivered: compliance?.info_sheet_delivered ?? false,
    identityVerified: compliance?.identity_verified ?? false,
    identityDocumentId: compliance?.identity_document_id ?? "",
    riskLevel: compliance?.risk_level ?? "",
    isPep: compliance?.is_pep ?? false,
    pepDetails: compliance?.pep_details ?? "",
    fundsOrigin: compliance?.funds_origin ?? "",
    lcbftNotes: compliance?.lcbft_notes ?? "",
    consentDataProcessing: compliance?.consent_data_processing ?? false,
    consentMarketing: compliance?.consent_marketing ?? false,
    erasureRequested: compliance?.erasure_requested ?? false,
  });

  function update<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  // Live status reflects the in-progress form, not just the saved record.
  const liveStatus = computeComplianceStatus({
    ...(compliance ?? ({} as BrokerComplianceRow)),
    info_sheet_delivered: form.infoSheetDelivered,
    identity_verified: form.identityVerified,
    risk_level: (form.riskLevel || null) as BrokerComplianceRow["risk_level"],
    consent_data_processing: form.consentDataProcessing,
  });
  const level = complianceLevel(liveStatus);
  const tone = complianceLevelTone[level];

  async function handleSave() {
    if (saving || !canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/compliance`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            infoSheetDelivered: form.infoSheetDelivered,
            identityVerified: form.identityVerified,
            identityDocumentId: form.identityDocumentId || null,
            riskLevel: form.riskLevel || null,
            isPep: form.isPep,
            pepDetails: form.pepDetails || null,
            fundsOrigin: form.fundsOrigin || null,
            lcbftNotes: form.lcbftNotes || null,
            consentDataProcessing: form.consentDataProcessing,
            consentMarketing: form.consentMarketing,
            erasureRequested: form.erasureRequested,
          }),
        },
      ).catch(() => null);

      const result = (await res?.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;

      if (!res?.ok || !result?.success) {
        toast.error("Enregistrement impossible.", {
          description: result?.message ?? "Veuillez réessayer.",
        });
        return;
      }
      toast.success("Conformité enregistrée.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const idDocuments = documents.filter(
    (d) => d.category === "id_document" || d.category === "other",
  );

  return (
    <div className="space-y-5">
      {/* Status header */}
      <div
        className="flex items-center gap-3 rounded-md border px-4 py-3"
        style={{ borderColor: tone.bd, background: tone.bg }}
      >
        <span style={{ color: tone.fg }}>
          {level === "complete" ? (
            <ShieldCheck className="size-5" strokeWidth={1.75} />
          ) : (
            <ShieldAlert className="size-5" strokeWidth={1.75} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold" style={{ color: tone.fg }}>
            {complianceLevelLabels[level]}
            <span className="ml-2 font-normal text-[var(--fg-3)]">
              {liveStatus.completedCount}/{liveStatus.totalCount} obligations
            </span>
          </p>
          {liveStatus.missing.length > 0 ? (
            <p className="mt-0.5 truncate text-[11.5px] text-[var(--fg-3)]">
              À compléter : {liveStatus.missing.join(", ")}
            </p>
          ) : (
            <p className="mt-0.5 text-[11.5px] text-[var(--fg-3)]">
              Toutes les obligations réglementaires sont satisfaites.
            </p>
          )}
        </div>
      </div>

      {/* DDA */}
      <section className="space-y-3">
        <p className="fd-eyebrow">Devoir de conseil (DDA)</p>
        <ToggleRow
          label="Fiche d’information remise au client"
          description="Document précontractuel obligatoire (identité du cabinet, ORIAS, médiation)."
          checked={form.infoSheetDelivered}
          onChange={(v) => update("infoSheetDelivered", v)}
          disabled={!canEdit || saving}
        />
      </section>

      {/* LCB-FT */}
      <section className="space-y-3">
        <p className="fd-eyebrow">Lutte anti-blanchiment (LCB-FT)</p>
        <ToggleRow
          label="Identité du client vérifiée"
          description="Pièce d’identité contrôlée et conservée au dossier."
          checked={form.identityVerified}
          onChange={(v) => update("identityVerified", v)}
          disabled={!canEdit || saving}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Pièce d’identité (document)</Label>
            <Select
              value={form.identityDocumentId || NO_DOC}
              onValueChange={(value) =>
                update("identityDocumentId", value === NO_DOC ? "" : value)
              }
              disabled={!canEdit || saving}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Aucun document lié" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DOC}>Aucun document lié</SelectItem>
                {idDocuments.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    {doc.title} · {documentCategoryLabel(doc.category)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Niveau de risque</Label>
            <Select
              value={form.riskLevel || NO_RISK}
              onValueChange={(value) =>
                update("riskLevel", value === NO_RISK ? "" : value)
              }
              disabled={!canEdit || saving}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Non évalué" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_RISK}>Non évalué</SelectItem>
                {brokerRiskLevels.map((r) => (
                  <SelectItem key={r} value={r}>
                    {brokerRiskLevelLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ToggleRow
          label="Personne politiquement exposée (PPE)"
          description="Le client exerce ou a exercé une fonction publique importante."
          checked={form.isPep}
          onChange={(v) => update("isPep", v)}
          disabled={!canEdit || saving}
        />

        {form.isPep ? (
          <div className="space-y-1.5">
            <Label htmlFor="cp-pep">Précisions PPE</Label>
            <Textarea
              id="cp-pep"
              value={form.pepDetails}
              onChange={(e) => update("pepDetails", e.target.value)}
              placeholder="Fonction concernée, mesures de vigilance renforcée appliquées…"
              rows={2}
              disabled={!canEdit || saving}
            />
          </div>
        ) : null}

        {form.riskLevel === "high" ? (
          <div className="space-y-1.5">
            <Label htmlFor="cp-funds">Origine des fonds</Label>
            <Textarea
              id="cp-funds"
              value={form.fundsOrigin}
              onChange={(e) => update("fundsOrigin", e.target.value)}
              placeholder="Origine déclarée des fonds (vigilance renforcée)."
              rows={2}
              disabled={!canEdit || saving}
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="cp-notes">Notes LCB-FT</Label>
          <Textarea
            id="cp-notes"
            value={form.lcbftNotes}
            onChange={(e) => update("lcbftNotes", e.target.value)}
            placeholder="Observations sur la vigilance exercée."
            rows={2}
            disabled={!canEdit || saving}
          />
        </div>
      </section>

      {/* RGPD */}
      <section className="space-y-3">
        <p className="fd-eyebrow">Protection des données (RGPD)</p>
        <ToggleRow
          label="Consentement au traitement des données"
          description="Le client a consenti au traitement de ses données personnelles."
          checked={form.consentDataProcessing}
          onChange={(v) => update("consentDataProcessing", v)}
          disabled={!canEdit || saving}
        />
        <ToggleRow
          label="Consentement aux communications commerciales"
          description="Optionnel — pour les relances et offres commerciales."
          checked={form.consentMarketing}
          onChange={(v) => update("consentMarketing", v)}
          disabled={!canEdit || saving}
        />
        <ToggleRow
          label="Demande d’effacement (droit à l’oubli)"
          description="Marque le dossier comme faisant l’objet d’une demande d’effacement."
          checked={form.erasureRequested}
          onChange={(v) => update("erasureRequested", v)}
          disabled={!canEdit || saving}
        />
      </section>

      {canEdit ? (
        <div className="flex items-center justify-end pt-1">
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5"
          >
            <Check className="size-3.5" strokeWidth={2} />
            {saving ? "Enregistrement…" : "Enregistrer la conformité"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
