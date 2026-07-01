"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  cabinetComplianceFields,
  isCabinetComplianceComplete,
  type CabinetComplianceInfo,
  type CabinetFieldGroup,
} from "@/lib/broker/compliance";

const groups: {
  key: CabinetFieldGroup;
  title: string;
  description: string;
}[] = [
  {
    key: "identity",
    title: "Identité du cabinet",
    description: "Les informations légales de votre cabinet de courtage.",
  },
  {
    key: "regulatory",
    title: "Immatriculation & garanties",
    description:
      "Immatriculation ORIAS, rémunération, responsabilité civile professionnelle et autorité de contrôle.",
  },
  {
    key: "recourse",
    title: "Réclamation & médiation",
    description:
      "Le service réclamation du cabinet et le médiateur compétent en cas de litige.",
  },
  {
    key: "rgpd",
    title: "Protection des données (RGPD)",
    description:
      "Délégué à la protection des données, repris dans le devoir de conseil.",
  },
];

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-lg border bg-[var(--bg-surface)] p-5"
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--fg-1)]">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-[12.5px] leading-5 text-[var(--fg-3)]">
          {description}
        </p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function ComplianceSettingsForm({
  initial,
  initialEnabled,
  canEdit,
}: {
  initial: CabinetComplianceInfo;
  initialEnabled: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<CabinetComplianceInfo>(initial);
  const [saving, setSaving] = React.useState(false);
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [togglingModule, setTogglingModule] = React.useState(false);

  function update(key: keyof CabinetComplianceInfo, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function toggleModule(next: boolean) {
    if (togglingModule || !canEdit) return;
    setEnabled(next);
    setTogglingModule(true);
    try {
      const res = await fetch("/api/courtier/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complianceEnabled: next }),
      }).catch(() => null);
      if (!res?.ok) {
        setEnabled(!next);
        toast.error("Action impossible.");
        return;
      }
      toast.success(
        next ? "Module Conformité activé." : "Module Conformité désactivé.",
      );
      router.refresh();
    } finally {
      setTogglingModule(false);
    }
  }

  const complete = isCabinetComplianceComplete(form);

  async function save() {
    if (saving || !canEdit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/courtier/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compliance: form }),
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
      toast.success("Fiche d’information enregistrée.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div
        className="flex items-center justify-between gap-4 rounded-lg border bg-[var(--bg-surface)] px-4 py-3.5"
        style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-[var(--fg-1)]">
            Module Conformité
          </p>
          <p className="mt-0.5 text-[12px] leading-5 text-[var(--fg-3)]">
            Affiche le suivi DDA / LCB-FT / RGPD sur chaque dossier client.
            Désactivez-le si votre cabinet n’en a pas l’usage.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Activer le module Conformité"
          disabled={!canEdit || togglingModule}
          onClick={() => toggleModule(!enabled)}
          className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
          style={{
            background: enabled
              ? "var(--brand-navy-800)"
              : "var(--border-strong, #d4d0c8)",
          }}
        >
          <span
            className="inline-block size-4 rounded-full bg-white shadow-sm transition-transform"
            style={{ transform: enabled ? "translateX(22px)" : "translateX(3px)" }}
          />
        </button>
      </div>

      <div
        className="flex items-start gap-3 rounded-lg border px-4 py-3.5"
        style={{
          borderColor: complete
            ? "rgba(21,128,61,0.2)"
            : "var(--brand-amber-200, rgba(184,146,42,0.25))",
          background: complete
            ? "var(--success-soft, #f0fdf4)"
            : "var(--brand-amber-50, #fdf7e8)",
        }}
      >
        <ShieldCheck
          className="mt-0.5 size-5 shrink-0"
          strokeWidth={1.75}
          style={{
            color: complete
              ? "var(--success, #15803d)"
              : "var(--brand-amber-800, #92610f)",
          }}
        />
        <div>
          <p className="text-[13px] font-semibold text-[var(--fg-1)]">
            Fiche d’information précontractuelle (DDA)
          </p>
          <p className="mt-0.5 text-[12px] leading-5 text-[var(--fg-3)]">
            Ces informations alimentent la fiche d’information remise à chaque
            client et le devoir de conseil. Renseignez au minimum la
            dénomination, le n° ORIAS et l’assureur RCP.
          </p>
        </div>
      </div>

      {groups.map((group) => (
        <SectionCard
          key={group.key}
          title={group.title}
          description={group.description}
        >
          {cabinetComplianceFields
            .filter((field) => field.group === group.key)
            .filter(
              (field) =>
                !(field.key === "dpoContact" && form.dpoMode === "none"),
            )
            .map((field) => (
              <div
                key={field.key}
                className={field.multiline ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}
              >
                <Label htmlFor={`cc-${field.key}`}>{field.label}</Label>
                {field.type === "select" ? (
                  <select
                    id={`cc-${field.key}`}
                    value={form[field.key]}
                    onChange={(e) => update(field.key, e.target.value)}
                    disabled={!canEdit || saving}
                    className="flex h-9 w-full rounded-md border bg-transparent px-3 text-[13px] text-[var(--fg-1)] shadow-sm outline-none focus:ring-2 focus:ring-[var(--brand-navy-800)] disabled:opacity-50"
                    style={{ borderColor: "var(--border-1)" }}
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.multiline ? (
                  <Textarea
                    id={`cc-${field.key}`}
                    value={form[field.key]}
                    onChange={(e) => update(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={2}
                    disabled={!canEdit || saving}
                  />
                ) : (
                  <Input
                    id={`cc-${field.key}`}
                    value={form[field.key]}
                    onChange={(e) => update(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    disabled={!canEdit || saving}
                  />
                )}
              </div>
            ))}
        </SectionCard>
      ))}

      {canEdit ? (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5"
          >
            <Check className="size-3.5" strokeWidth={2} />
            {saving ? "Enregistrement…" : "Enregistrer la fiche"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
