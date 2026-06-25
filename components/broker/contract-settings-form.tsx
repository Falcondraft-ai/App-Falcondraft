"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  brokerInsuranceTypeLabels,
  brokerInsuranceTypes,
  type BrokerInsuranceType,
} from "@/lib/broker/clients";
import { commonInsurerSuggestions } from "@/lib/broker/settings";
import { cn } from "@/lib/utils";

export function ContractSettingsForm({
  initialBranches,
  initialInsurers,
  canEdit,
}: {
  initialBranches: BrokerInsuranceType[];
  initialInsurers: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [branches, setBranches] = React.useState<Set<string>>(
    new Set(initialBranches),
  );
  const [insurers, setInsurers] = React.useState<string[]>(initialInsurers);
  const [insurerInput, setInsurerInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  function toggleBranch(branch: BrokerInsuranceType) {
    if (!canEdit) return;
    setBranches((cur) => {
      const next = new Set(cur);
      if (next.has(branch)) next.delete(branch);
      else next.add(branch);
      return next;
    });
  }

  function addInsurer(name: string) {
    const clean = name.trim();
    if (!clean) return;
    setInsurers((cur) =>
      cur.some((i) => i.toLowerCase() === clean.toLowerCase())
        ? cur
        : [...cur, clean],
    );
    setInsurerInput("");
  }

  function removeInsurer(name: string) {
    setInsurers((cur) => cur.filter((i) => i !== name));
  }

  async function save() {
    if (branches.size === 0) {
      toast.error("Activez au moins une branche.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/courtier/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabledBranches: [...branches],
          partnerInsurers: insurers,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        toast.error("Enregistrement impossible", {
          description: data?.message,
        });
        return;
      }
      toast.success("Paramètres enregistrés.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const availableSuggestions = commonInsurerSuggestions.filter(
    (s) => !insurers.some((i) => i.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      {/* Branches */}
      <section
        className="rounded-lg border bg-[var(--bg-surface)] p-5"
        style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
      >
        <h2 className="text-[14px] font-semibold text-[var(--fg-1)]">
          Branches d’assurance proposées
        </h2>
        <p className="mt-1 text-[12.5px] leading-5 text-[var(--fg-3)]">
          Sélectionnez les types de contrat que votre cabinet gère. Ils
          alimentent les choix lors de la création d’un dossier.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {brokerInsuranceTypes.map((branch) => {
            const active = branches.has(branch);
            return (
              <button
                key={branch}
                type="button"
                onClick={() => toggleBranch(branch)}
                disabled={!canEdit}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-[13px] font-medium transition-colors disabled:opacity-60",
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
                        color: "var(--fg-3)",
                      }
                }
              >
                <span
                  className="flex size-4 shrink-0 items-center justify-center rounded-[4px]"
                  style={{
                    border: `1px solid ${active ? "var(--brand-navy-700)" : "var(--border-strong)"}`,
                    background: active ? "var(--brand-navy-700)" : "transparent",
                  }}
                >
                  {active ? (
                    <Check className="size-3 text-white" strokeWidth={3} />
                  ) : null}
                </span>
                {brokerInsuranceTypeLabels[branch]}
              </button>
            );
          })}
        </div>
      </section>

      {/* Partner insurers */}
      <section
        className="rounded-lg border bg-[var(--bg-surface)] p-5"
        style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
      >
        <h2 className="text-[14px] font-semibold text-[var(--fg-1)]">
          Compagnies partenaires
        </h2>
        <p className="mt-1 text-[12.5px] leading-5 text-[var(--fg-3)]">
          Les assureurs avec lesquels vous travaillez, pour accélérer la saisie
          des devis.
        </p>

        {insurers.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {insurers.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium"
                style={{
                  borderColor: "var(--border-1)",
                  background: "var(--brand-navy-50)",
                  color: "var(--brand-navy-800)",
                }}
              >
                {name}
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => removeInsurer(name)}
                    aria-label={`Retirer ${name}`}
                    className="text-[var(--fg-4)] hover:text-[var(--destructive)]"
                  >
                    <X className="size-3.5" strokeWidth={2} />
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[12.5px] text-[var(--fg-3)]">
            Aucune compagnie ajoutée.
          </p>
        )}

        {canEdit ? (
          <>
            <div className="mt-4 flex gap-2">
              <Input
                value={insurerInput}
                onChange={(e) => setInsurerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addInsurer(insurerInput);
                  }
                }}
                placeholder="Ajouter une compagnie…"
                className="max-w-xs"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => addInsurer(insurerInput)}
              >
                <Plus className="size-3.5" strokeWidth={2} />
                Ajouter
              </Button>
            </div>
            {availableSuggestions.length > 0 ? (
              <div className="mt-3">
                <p className="fd-eyebrow mb-2">Suggestions</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addInsurer(s)}
                      className="rounded-full border px-2.5 py-1 text-[12px] text-[var(--fg-2)] transition-colors hover:bg-[var(--brand-navy-50)]"
                      style={{ borderColor: "var(--border-1)" }}
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
