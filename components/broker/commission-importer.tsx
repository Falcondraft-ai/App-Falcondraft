"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileUp,
  Link2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  LineClientOption,
  LineContractOption,
} from "@/components/broker/commission-line-form";
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
import { formatEuro } from "@/lib/broker/commissions";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx";
const NO_CLIENT = "__none__";
const NO_CONTRACT = "__none__";

type Confidence = "high" | "medium" | "low";
type MatchConfidence = "high" | "medium" | "none";

type ReviewLine = {
  id: string;
  rawClientName: string | null;
  rawPolicy: string | null;
  insurerName: string;
  label: string;
  clientId: string;
  contractId: string;
  baseAmount: string;
  rate: string;
  commissionAmount: string;
  retrocessionRate: string;
  retrocessionAmount: string;
  retrocessionBeneficiary: string;
  periodLabel: string;
  currency: string;
  confidence: Confidence;
  matchConfidence: MatchConfidence;
  matchReason: string;
};

type StatementForm = {
  insurerName: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: string;
  currency: string;
};

type ApiMatch = {
  clientId: string | null;
  contractId: string | null;
  confidence: MatchConfidence;
  reason: string;
};
type ApiLine = {
  insurer_name: string | null;
  client_name: string | null;
  policy_number: string | null;
  label: string | null;
  base_amount: number | null;
  rate: number | null;
  commission_amount: number | null;
  retrocession_rate: number | null;
  retrocession_amount: number | null;
  period_label: string | null;
  currency: string;
  confidence: Confidence;
  match: ApiMatch;
  clientName: string | null;
};
type ApiStatement = {
  insurer_name: string | null;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  declared_total: number | null;
  currency: string;
};
type ExtractResponse =
  | { success: true; sourceKind: string; statement: ApiStatement; lines: ApiLine[] }
  | { success: false; message?: string };

function numToStr(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "" : String(n);
}
function parseNum(value: string): number | null {
  const t = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function localId(): string {
  return Math.random().toString(36).slice(2);
}

function ConfidenceDot({ level }: { level: Confidence }) {
  const color =
    level === "high" ? "#15803D" : level === "medium" ? "#B45309" : "#B91C1C";
  const label =
    level === "high"
      ? "Lecture fiable"
      : level === "medium"
        ? "À vérifier"
        : "Lecture incertaine";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] text-[var(--fg-3)]"
      title={label}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function MatchBadge({ level }: { level: MatchConfidence }) {
  const map = {
    high: { bg: "var(--success-soft, #f0fdf4)", fg: "#15803D", text: "Rattaché · police" },
    medium: { bg: "var(--brand-amber-50, #fdf7e8)", fg: "#92610f", text: "Rattaché · nom" },
    none: { bg: "var(--bg-sunken)", fg: "var(--fg-3)", text: "À rattacher" },
  }[level];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em]"
      style={{ background: map.bg, color: map.fg }}
    >
      <Link2 className="size-3" strokeWidth={2} />
      {map.text}
    </span>
  );
}

export function CommissionImporter({
  clients,
  contracts,
  insurers,
}: {
  clients: LineClientOption[];
  contracts: LineContractOption[];
  insurers: string[];
}) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<
    "idle" | "extracting" | "review" | "importing"
  >("idle");
  const [file, setFile] = React.useState<File | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [statement, setStatement] = React.useState<StatementForm>({
    insurerName: "",
    periodLabel: "",
    periodStart: "",
    periodEnd: "",
    totalAmount: "",
    currency: "EUR",
  });
  const [lines, setLines] = React.useState<ReviewLine[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function runExtraction(f: File) {
    setFile(f);
    setPhase("extracting");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/broker/commissions/extract", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as ExtractResponse | null;
      if (!res.ok || !data || !data.success) {
        toast.error("Analyse du bordereau impossible", {
          description:
            (data && "message" in data && data.message) ||
            "Vérifiez le fichier et réessayez.",
        });
        setPhase("idle");
        setFile(null);
        return;
      }
      setStatement({
        insurerName: data.statement.insurer_name ?? "",
        periodLabel: data.statement.period_label ?? "",
        periodStart: data.statement.period_start ?? "",
        periodEnd: data.statement.period_end ?? "",
        totalAmount: numToStr(data.statement.declared_total),
        currency: data.statement.currency || "EUR",
      });
      setLines(
        data.lines.map((l) => ({
          id: localId(),
          rawClientName: l.client_name,
          rawPolicy: l.policy_number,
          insurerName: l.insurer_name ?? data.statement.insurer_name ?? "",
          label: l.label ?? "",
          clientId: l.match.clientId ?? "",
          contractId: l.match.contractId ?? "",
          baseAmount: numToStr(l.base_amount),
          rate: numToStr(l.rate),
          commissionAmount: numToStr(l.commission_amount),
          retrocessionRate: numToStr(l.retrocession_rate),
          retrocessionAmount: numToStr(l.retrocession_amount),
          retrocessionBeneficiary: "",
          periodLabel: l.period_label ?? "",
          currency: l.currency || "EUR",
          confidence: l.confidence,
          matchConfidence: l.match.confidence,
          matchReason: l.match.reason,
        })),
      );
      setPhase("review");
      toast.success(
        `${data.lines.length} ligne${data.lines.length > 1 ? "s" : ""} extraite${
          data.lines.length > 1 ? "s" : ""
        }. Vérifiez avant d’importer.`,
      );
    } catch {
      toast.error("Analyse du bordereau impossible.");
      setPhase("idle");
      setFile(null);
    }
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (f) void runExtraction(f);
  }

  function updateLine(id: string, patch: Partial<ReviewLine>) {
    setLines((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function removeLine(id: string) {
    setLines((cur) => cur.filter((l) => l.id !== id));
  }
  function addLine() {
    setLines((cur) => [
      ...cur,
      {
        id: localId(),
        rawClientName: null,
        rawPolicy: null,
        insurerName: statement.insurerName,
        label: "",
        clientId: "",
        contractId: "",
        baseAmount: "",
        rate: "",
        commissionAmount: "",
        retrocessionRate: "",
        retrocessionAmount: "",
        retrocessionBeneficiary: "",
        periodLabel: statement.periodLabel,
        currency: statement.currency,
        confidence: "high",
        matchConfidence: "none",
        matchReason: "Ajout manuel",
      },
    ]);
  }

  const linesTotal = lines.reduce(
    (sum, l) => sum + (parseNum(l.commissionAmount) ?? 0),
    0,
  );
  const declared = parseNum(statement.totalAmount);
  const diff =
    declared === null ? null : Math.round((declared - linesTotal) * 100) / 100;
  const reconciles = diff !== null && Math.abs(diff) < 0.01;
  const unmatched = lines.filter((l) => !l.clientId).length;

  async function runImport() {
    if (!file || phase === "importing") return;
    setPhase("importing");
    try {
      const payload = {
        statement: {
          insurerName: statement.insurerName.trim() || null,
          periodLabel: statement.periodLabel.trim() || null,
          periodStart: statement.periodStart || null,
          periodEnd: statement.periodEnd || null,
          totalAmount: parseNum(statement.totalAmount),
          currency: statement.currency || "EUR",
        },
        lines: lines.map((l) => ({
          insurerName: l.insurerName.trim() || null,
          label: l.label.trim() || null,
          clientId: l.clientId || null,
          contractId: l.contractId || null,
          baseAmount: parseNum(l.baseAmount),
          rate: parseNum(l.rate),
          commissionAmount: parseNum(l.commissionAmount),
          retrocessionRate: parseNum(l.retrocessionRate),
          retrocessionAmount: parseNum(l.retrocessionAmount),
          retrocessionBeneficiary: l.retrocessionBeneficiary.trim() || null,
          periodLabel: l.periodLabel.trim() || null,
          currency: l.currency || "EUR",
        })),
      };
      const fd = new FormData();
      fd.append("file", file);
      fd.append("data", JSON.stringify(payload));
      const res = await fetch("/api/broker/commissions/import", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        statementId?: string;
        message?: string;
      } | null;
      if (!res.ok || !data?.success || !data.statementId) {
        toast.error("Import impossible", {
          description: data?.message ?? "Veuillez réessayer.",
        });
        setPhase("review");
        return;
      }
      toast.success("Bordereau importé.");
      router.push(`/courtier/commissions/${data.statementId}`);
      router.refresh();
    } catch {
      toast.error("Import impossible.");
      setPhase("review");
    }
  }

  // -------------------------------------------------------------------------
  // Idle / extracting — the drop zone
  // -------------------------------------------------------------------------
  if (phase === "idle" || phase === "extracting") {
    const busy = phase === "extracting";
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) void runExtraction(f);
        }}
        className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors"
        style={{
          borderColor: dragOver ? "var(--brand-navy-400)" : "var(--border-1)",
          background: dragOver ? "var(--brand-navy-50)" : "var(--bg-surface)",
        }}
      >
        <span
          className="mb-4 flex size-12 items-center justify-center rounded-xl"
          style={{ background: "var(--brand-navy-50)", color: "var(--brand-navy-700)" }}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" strokeWidth={2} />
          ) : (
            <FileUp className="size-5" strokeWidth={1.75} />
          )}
        </span>
        <p className="text-[14px] font-semibold text-[var(--fg-1)]">
          {busy ? "Analyse du bordereau en cours…" : "Déposez le bordereau de la compagnie"}
        </p>
        <p className="mt-1 max-w-sm text-[12.5px] leading-5 text-[var(--fg-3)]">
          {busy
            ? "L’IA lit les lignes, détecte les montants et rattache vos dossiers. Quelques secondes."
            : "PDF, image, Excel (.xlsx) ou CSV. L’IA en extrait les lignes de commission ; vous validez avant l’enregistrement."}
        </p>
        {!busy ? (
          <div className="mt-5">
            <Button type="button" onClick={() => fileInputRef.current?.click()}>
              <Sparkles className="mr-1.5 size-3.5" strokeWidth={2} />
              Choisir un fichier
            </Button>
          </div>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={onPick}
          className="hidden"
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Review
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* Statement header */}
      <section
        className="rounded-lg border bg-[var(--bg-surface)] p-5"
        style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-semibold text-[var(--fg-1)]">
            Bordereau
          </h2>
          <button
            type="button"
            onClick={() => {
              setPhase("idle");
              setFile(null);
              setLines([]);
            }}
            disabled={phase === "importing"}
            className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-3)] transition-colors hover:text-[var(--fg-1)] disabled:opacity-50"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Changer de fichier
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="imp-insurer">Compagnie</Label>
            <Input
              id="imp-insurer"
              list="imp-insurer-list"
              value={statement.insurerName}
              onChange={(e) =>
                setStatement((s) => ({ ...s, insurerName: e.target.value }))
              }
              placeholder="Ex. AXA"
            />
            {insurers.length > 0 ? (
              <datalist id="imp-insurer-list">
                {insurers.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imp-period">Période</Label>
            <Input
              id="imp-period"
              value={statement.periodLabel}
              onChange={(e) =>
                setStatement((s) => ({ ...s, periodLabel: e.target.value }))
              }
              placeholder="Ex. T1 2026"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imp-start">Début</Label>
            <Input
              id="imp-start"
              type="date"
              value={statement.periodStart}
              onChange={(e) =>
                setStatement((s) => ({ ...s, periodStart: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imp-end">Fin</Label>
            <Input
              id="imp-end"
              type="date"
              value={statement.periodEnd}
              onChange={(e) =>
                setStatement((s) => ({ ...s, periodEnd: e.target.value }))
              }
            />
          </div>
        </div>
      </section>

      {/* Live reconciliation */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 rounded-md border p-4" style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}>
          <Label htmlFor="imp-total">Total annoncé par la compagnie</Label>
          <Input
            id="imp-total"
            inputMode="decimal"
            value={statement.totalAmount}
            onChange={(e) =>
              setStatement((s) => ({ ...s, totalAmount: e.target.value }))
            }
            placeholder="Ex. 4 250"
          />
        </div>
        <div
          className="rounded-md border px-4 py-3"
          style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}
        >
          <p className="fd-eyebrow">Total des lignes</p>
          <p className="mt-1.5 text-[18px] font-semibold tracking-[-0.01em] text-[var(--fg-1)]">
            {formatEuro(linesTotal, statement.currency)}
          </p>
        </div>
        <div
          className="rounded-md border px-4 py-3"
          style={{
            borderColor: diff === null ? "var(--border-1)" : reconciles ? "rgba(21,128,61,0.3)" : "var(--brand-amber-200, rgba(184,146,42,0.3))",
            background: diff === null ? "var(--bg-surface)" : reconciles ? "var(--success-soft, #f0fdf4)" : "var(--brand-amber-50, #fdf7e8)",
          }}
        >
          <p className="fd-eyebrow">Écart</p>
          <p
            className="mt-1.5 text-[18px] font-semibold tracking-[-0.01em]"
            style={{
              color: diff === null ? "var(--fg-1)" : reconciles ? "#15803D" : "#92610f",
            }}
          >
            {diff === null ? "—" : formatEuro(diff, statement.currency)}
          </p>
        </div>
      </div>

      {/* Lines */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-[var(--fg-1)]">
            Lignes extraites{" "}
            <span className="text-[var(--fg-3)]">({lines.length})</span>
          </h2>
          {unmatched > 0 ? (
            <span className="text-[12px] text-[var(--fg-3)]">
              {unmatched} ligne{unmatched > 1 ? "s" : ""} à rattacher
            </span>
          ) : null}
        </div>

        <AnimatePresence initial={false}>
          {lines.map((line) => {
            const contractOptions = line.clientId
              ? contracts.filter((c) => c.clientId === line.clientId)
              : [];
            return (
              <motion.div
                key={line.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-lg border p-4"
                style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <MatchBadge level={line.matchConfidence} />
                    <ConfidenceDot level={line.confidence} />
                    {line.rawClientName || line.rawPolicy ? (
                      <span className="text-[11px] text-[var(--fg-4)]">
                        Bordereau : {line.rawClientName ?? "—"}
                        {line.rawPolicy ? ` · n° ${line.rawPolicy}` : ""}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    aria-label="Supprimer la ligne"
                    className="flex size-7 items-center justify-center rounded-md text-[var(--fg-4)] transition-colors hover:bg-[var(--destructive-soft,#fef2f2)] hover:text-[var(--destructive)]"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5 lg:col-span-1">
                    <Label>Libellé</Label>
                    <Input
                      value={line.label}
                      onChange={(e) => updateLine(line.id, { label: e.target.value })}
                      placeholder="Nature de la commission"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Dossier client</Label>
                    <Select
                      value={line.clientId || NO_CLIENT}
                      onValueChange={(value) =>
                        updateLine(line.id, {
                          clientId: value === NO_CLIENT ? "" : value,
                          contractId: "",
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="À rattacher" />
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
                      value={line.contractId || NO_CONTRACT}
                      onValueChange={(value) =>
                        updateLine(line.id, {
                          contractId: value === NO_CONTRACT ? "" : value,
                        })
                      }
                      disabled={!line.clientId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={line.clientId ? "Aucun" : "Choisir un dossier"}
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
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="space-y-1.5">
                    <Label>Assiette (€)</Label>
                    <Input
                      inputMode="decimal"
                      value={line.baseAmount}
                      onChange={(e) => updateLine(line.id, { baseAmount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Taux (%)</Label>
                    <Input
                      inputMode="decimal"
                      value={line.rate}
                      onChange={(e) => updateLine(line.id, { rate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Commission (€)</Label>
                    <Input
                      inputMode="decimal"
                      value={line.commissionAmount}
                      onChange={(e) =>
                        updateLine(line.id, { commissionAmount: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Apporteur</Label>
                    <Input
                      value={line.retrocessionBeneficiary}
                      onChange={(e) =>
                        updateLine(line.id, { retrocessionBeneficiary: e.target.value })
                      }
                      placeholder="Optionnel"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rétrocédé (€)</Label>
                    <Input
                      inputMode="decimal"
                      value={line.retrocessionAmount}
                      onChange={(e) =>
                        updateLine(line.id, { retrocessionAmount: e.target.value })
                      }
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <Button
          type="button"
          variant="ghost"
          onClick={addLine}
          className="inline-flex items-center gap-1.5"
        >
          <Plus className="size-3.5" strokeWidth={2} />
          Ajouter une ligne
        </Button>
      </section>

      {/* Actions */}
      <div
        className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
        style={{
          borderColor: "var(--border-1)",
          background: "var(--bg-surface)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <p className="text-[12.5px] text-[var(--fg-3)]">
          {lines.length} ligne{lines.length > 1 ? "s" : ""} ·{" "}
          {formatEuro(linesTotal, statement.currency)}
          {diff !== null && !reconciles ? (
            <span style={{ color: "#92610f" }}>
              {" "}
              · écart {formatEuro(diff, statement.currency)}
            </span>
          ) : null}
        </p>
        <Button
          type="button"
          onClick={runImport}
          disabled={phase === "importing" || lines.length === 0}
        >
          {phase === "importing" ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" strokeWidth={2} />
          ) : null}
          {phase === "importing" ? "Import…" : "Importer le bordereau"}
        </Button>
      </div>
    </div>
  );
}
