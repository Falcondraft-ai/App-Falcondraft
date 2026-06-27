"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronDown, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuro } from "@/lib/broker/commissions";
import { formatRate } from "@/lib/broker/introducers";
import { cn } from "@/lib/utils";
import type { BrokerIntroducerRow } from "@/types/database";

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function IntroducerForm({
  introducer,
  mode,
  onDone,
  onCancel,
}: {
  introducer?: BrokerIntroducerRow;
  mode: "create" | "edit";
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState<"none" | "save" | "delete">("none");
  const [form, setForm] = React.useState({
    name: introducer?.name ?? "",
    rate:
      introducer?.retrocession_rate != null
        ? String(introducer.retrocession_rate)
        : "",
    email: introducer?.email ?? "",
    phone: introducer?.phone ?? "",
    notes: introducer?.notes ?? "",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((c) => ({ ...c, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving !== "none") return;
    if (!form.name.trim()) {
      toast.error("Le nom de l’apporteur est requis.");
      return;
    }
    setSaving("save");
    try {
      const url =
        mode === "edit" && introducer
          ? `/api/broker/introducers/${introducer.id}`
          : "/api/broker/introducers";
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          retrocessionRate: toNumberOrNull(form.rate),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          notes: form.notes.trim() || null,
        }),
      }).catch(() => null);

      const result = (await res?.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;

      if (!res?.ok || !result?.success) {
        toast.error(
          mode === "edit" ? "Modification impossible." : "Apporteur non créé.",
          { description: result?.message ?? "Veuillez réessayer." },
        );
        return;
      }
      toast.success(mode === "edit" ? "Apporteur enregistré." : "Apporteur ajouté.");
      onDone();
      router.refresh();
    } finally {
      setSaving("none");
    }
  }

  async function handleDelete() {
    if (!introducer || saving !== "none") return;
    if (!window.confirm("Supprimer cet apporteur ?")) return;
    setSaving("delete");
    try {
      const res = await fetch(`/api/broker/introducers/${introducer.id}`, {
        method: "DELETE",
      }).catch(() => null);
      if (!res?.ok) {
        toast.error("Suppression impossible.");
        return;
      }
      toast.success("Apporteur supprimé.");
      onDone();
      router.refresh();
    } finally {
      setSaving("none");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="intro-name">Nom de l’apporteur</Label>
          <Input
            id="intro-name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Ex. Cabinet Durand"
            disabled={saving !== "none"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="intro-rate">Taux de rétrocession (%)</Label>
          <Input
            id="intro-rate"
            inputMode="decimal"
            value={form.rate}
            onChange={(e) => update("rate", e.target.value)}
            placeholder="Ex. 20"
            disabled={saving !== "none"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="intro-email">Email</Label>
          <Input
            id="intro-email"
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="Optionnel"
            disabled={saving !== "none"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="intro-phone">Téléphone</Label>
          <Input
            id="intro-phone"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="Optionnel"
            disabled={saving !== "none"}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="intro-notes">Notes</Label>
        <Input
          id="intro-notes"
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Optionnel"
          disabled={saving !== "none"}
        />
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
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={saving !== "none"}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={saving !== "none"}>
            {saving === "save"
              ? "Enregistrement…"
              : mode === "edit"
                ? "Enregistrer"
                : "Ajouter l’apporteur"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function IntroducerManager({
  introducers,
  owedByIntroducer,
  canEdit,
}: {
  introducers: BrokerIntroducerRow[];
  owedByIntroducer: Record<string, number>;
  canEdit: boolean;
}) {
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  return (
    <div className="space-y-4">
      {introducers.length > 0 ? (
        <ul
          className="divide-y overflow-hidden rounded-lg border"
          style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}
        >
          {introducers.map((introducer) => {
            const editing = editingId === introducer.id;
            const owed = owedByIntroducer[introducer.id] ?? 0;
            return (
              <li key={introducer.id}>
                <button
                  type="button"
                  onClick={() =>
                    canEdit
                      ? setEditingId(editing ? null : introducer.id)
                      : undefined
                  }
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                    canEdit && "hover:bg-[rgba(14,34,56,0.025)]",
                  )}
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: "var(--brand-navy-50)",
                      color: "var(--brand-navy-700)",
                    }}
                  >
                    <UserPlus className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                      {introducer.name}
                    </p>
                    <p className="truncate text-[11.5px] text-[var(--fg-3)]">
                      Rétrocession {formatRate(introducer.retrocession_rate)}
                      {introducer.email ? ` · ${introducer.email}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] text-[var(--fg-3)]">Total dû</p>
                    <p className="text-[13px] font-semibold text-[var(--fg-1)]">
                      {formatEuro(owed)}
                    </p>
                  </div>
                  {canEdit ? (
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-[var(--fg-4)] transition-transform",
                        editing && "rotate-180",
                      )}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
                <AnimatePresence initial={false}>
                  {editing && canEdit ? (
                    <motion.div
                      key="edit"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden border-t"
                      style={{ borderColor: "var(--border-1)" }}
                    >
                      <div
                        className="px-4 py-4"
                        style={{ background: "var(--bg-sunken)" }}
                      >
                        <IntroducerForm
                          introducer={introducer}
                          mode="edit"
                          onDone={() => setEditingId(null)}
                          onCancel={() => setEditingId(null)}
                        />
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[12.5px] text-[var(--fg-3)]">
          Aucun apporteur enregistré. Ajoutez vos apporteurs d’affaires pour
          automatiser le calcul des rétrocessions.
        </p>
      )}

      {canEdit ? (
        <>
          <AnimatePresence initial={false}>
            {adding ? (
              <motion.div
                key="add-form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div
                  className="rounded-lg border p-4"
                  style={{
                    borderColor: "var(--border-1)",
                    background: "var(--bg-sunken)",
                  }}
                >
                  <IntroducerForm
                    mode="create"
                    onDone={() => setAdding(false)}
                    onCancel={() => setAdding(false)}
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          {!adding ? (
            <Button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5"
            >
              <Plus className="size-3.5" strokeWidth={2.25} />
              Nouvel apporteur
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
