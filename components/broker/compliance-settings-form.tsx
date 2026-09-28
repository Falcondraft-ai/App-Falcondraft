"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
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

type AssetKey = "logoUrl" | "annexEntreeEnRelation" | "annexMentions";

/** One company the documents can be issued under: the cabinet, or a profile. */
export type CabinetEntity = {
  profileId: string | null;
  label: string;
  fiche: CabinetComplianceInfo;
  hasOwnFiche: boolean;
  /** Viewable links for the filed assets (null = nothing filed). */
  assets: Record<AssetKey, string | null>;
};

const groups: {
  key: CabinetFieldGroup;
  title: string;
  description: string;
}[] = [
  {
    key: "identity",
    title: "Identité de la société",
    description: "Les informations légales imprimées en en-tête et en pied de page.",
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
      "Le service réclamation et le médiateur compétent en cas de litige.",
  },
  {
    key: "rgpd",
    title: "Protection des données (RGPD)",
    description:
      "Délégué à la protection des données, repris dans le devoir de conseil.",
  },
];

const assetRows: {
  kind: "logo" | "annexEntreeEnRelation" | "annexMentions";
  key: AssetKey;
  title: string;
  hint: string;
  accept: string;
  icon: typeof ImageIcon;
}[] = [
  {
    kind: "logo",
    key: "logoUrl",
    title: "Logo",
    hint: "En-tête du devoir de conseil — PNG ou JPEG, 2 Mo max.",
    accept: "image/png,image/jpeg",
    icon: ImageIcon,
  },
  {
    kind: "annexEntreeEnRelation",
    key: "annexEntreeEnRelation",
    title: "Document d’entrée en relation",
    hint: "Joint à l’email du devoir de conseil — PDF.",
    accept: "application/pdf",
    icon: FileText,
  },
  {
    kind: "annexMentions",
    key: "annexMentions",
    title: "Mentions d’information",
    hint: "Joint à l’email du devoir de conseil — PDF.",
    accept: "application/pdf",
    icon: FileText,
  },
];

/** Asset paths are never edited from the form — the upload route owns them. */
const ASSET_KEYS = new Set<keyof CabinetComplianceInfo>([
  "logoUrl",
  "annexEntreeEnRelation",
  "annexMentions",
]);

function SectionCard({
  title,
  description,
  children,
  grid = true,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  grid?: boolean;
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
      <div className={grid ? "mt-4 grid gap-4 sm:grid-cols-2" : "mt-4"}>
        {children}
      </div>
    </section>
  );
}

function entityKey(entity: CabinetEntity) {
  return entity.profileId ?? "cabinet";
}

export function CabinetSettingsForm({
  entities,
  canEdit,
}: {
  entities: CabinetEntity[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = React.useState(() =>
    entityKey(entities.find((e) => e.profileId && e.hasOwnFiche) ?? entities[0]),
  );
  const entity =
    entities.find((e) => entityKey(e) === selectedKey) ?? entities[0];
  const cabinet = entities.find((e) => e.profileId === null) ?? entities[0];

  const [form, setForm] = React.useState<CabinetComplianceInfo>(entity.fiche);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [assetBusy, setAssetBusy] = React.useState<AssetKey | null>(null);
  const fileInputs = React.useRef<Partial<Record<AssetKey, HTMLInputElement | null>>>({});

  function select(next: CabinetEntity) {
    if (entityKey(next) === selectedKey) return;
    if (
      dirty &&
      !window.confirm("Les modifications non enregistrées de cette fiche seront perdues.")
    ) {
      return;
    }
    setSelectedKey(entityKey(next));
    setForm(next.fiche);
    setDirty(false);
  }

  function update(key: keyof CabinetComplianceInfo, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  /** Starts a company's fiche from the cabinet's: mediator, ACPR… are shared. */
  function copyFromCabinet() {
    setForm((current) => {
      const next = { ...current };
      for (const key of Object.keys(cabinet.fiche) as (keyof CabinetComplianceInfo)[]) {
        if (ASSET_KEYS.has(key)) continue;
        if (!next[key]?.trim()) next[key] = cabinet.fiche[key];
      }
      return next;
    });
    setDirty(true);
  }

  async function save() {
    if (saving || !canEdit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/courtier/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compliance: form,
          ...(entity.profileId ? { profileId: entity.profileId } : {}),
        }),
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
      setDirty(false);
      toast.success("Fiche enregistrée.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function uploadAsset(row: (typeof assetRows)[number], file: File) {
    setAssetBusy(row.key);
    try {
      const body = new FormData();
      body.append("kind", row.kind);
      body.append("file", file);
      if (entity.profileId) body.append("profileId", entity.profileId);
      const res = await fetch("/api/courtier/settings/cabinet-asset", {
        method: "POST",
        body,
      }).catch(() => null);
      const result = (await res?.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;
      if (!res?.ok || !result?.success) {
        toast.error("Dépôt impossible.", {
          description: result?.message ?? "Veuillez réessayer.",
        });
        return;
      }
      toast.success(`${row.title} enregistré.`);
      router.refresh();
    } finally {
      setAssetBusy(null);
    }
  }

  async function removeAsset(row: (typeof assetRows)[number]) {
    if (!window.confirm(`Retirer « ${row.title} » de cette fiche ?`)) return;
    setAssetBusy(row.key);
    try {
      const params = new URLSearchParams({ kind: row.kind });
      if (entity.profileId) params.set("profileId", entity.profileId);
      const res = await fetch(`/api/courtier/settings/cabinet-asset?${params}`, {
        method: "DELETE",
      }).catch(() => null);
      if (!res?.ok) {
        toast.error("Action impossible.");
        return;
      }
      toast.success(`${row.title} retiré.`);
      router.refresh();
    } finally {
      setAssetBusy(null);
    }
  }

  const complete = isCabinetComplianceComplete(form);
  const isProfile = entity.profileId !== null;

  return (
    <div className="space-y-5">
      {entities.length > 1 ? (
        <div
          className="rounded-lg border bg-[var(--bg-surface)] p-4"
          style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--fg-3)]">
            Société
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2" role="tablist">
            {entities.map((option) => {
              const active = entityKey(option) === selectedKey;
              return (
                <button
                  key={entityKey(option)}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => select(option)}
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] transition-colors duration-150"
                  style={{
                    borderColor: active ? "var(--brand-navy-800)" : "var(--border-1)",
                    background: active ? "var(--brand-navy-800)" : "transparent",
                    color: active ? "#FFFFFF" : "var(--fg-1)",
                  }}
                >
                  <span className="font-medium">{option.label}</span>
                  <span
                    className="text-[11px]"
                    style={{ color: active ? "rgba(255,255,255,0.72)" : "var(--fg-3)" }}
                  >
                    {option.hasOwnFiche
                      ? option.fiche.legalName
                      : option.profileId
                        ? "fiche du cabinet"
                        : "à compléter"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] leading-5 text-[var(--fg-3)]">
            {isProfile
              ? `Les devoirs de conseil préparés par ${entity.label} sont émis au nom de cette société. Tant qu’aucune dénomination n’est renseignée, ils reprennent la fiche du cabinet.`
              : "Fiche par défaut, utilisée pour les documents d’un profil qui n’a pas la sienne."}
          </p>
        </div>
      ) : null}

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
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--fg-1)]">
            Mentions légales du devoir de conseil
          </p>
          <p className="mt-0.5 text-[12px] leading-5 text-[var(--fg-3)]">
            Ces informations figurent en en-tête et en pied de page de chaque
            devoir de conseil. Renseignez au minimum la dénomination, le n° ORIAS
            et l’assureur RCP.
          </p>
        </div>
        {isProfile && canEdit && cabinet.hasOwnFiche ? (
          <button
            type="button"
            onClick={copyFromCabinet}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium text-[var(--fg-1)] transition-colors duration-150 hover:bg-[var(--bg-sunken)]"
            style={{ borderColor: "var(--border-1)" }}
          >
            <Copy className="size-3.5" strokeWidth={2} />
            Compléter depuis le cabinet
          </button>
        ) : null}
      </div>

      <SectionCard
        title="Logo et documents joints"
        description="Propres à cette société : le logo de l’en-tête et les documents légaux joints à l’email du devoir de conseil."
        grid={false}
      >
        <div className="divide-y" style={{ borderColor: "var(--border-1)" }}>
          {assetRows.map((row) => {
            const link = entity.assets[row.key];
            const busy = assetBusy === row.key;
            const Icon = row.icon;
            return (
              <div
                key={row.key}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                style={{ borderColor: "var(--border-1)" }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Icon className="size-4 shrink-0 text-[var(--fg-3)]" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--fg-1)]">
                      {row.title}
                      <span
                        className="ml-2 text-[11px] font-normal"
                        style={{ color: link ? "var(--success, #15803d)" : "var(--fg-3)" }}
                      >
                        {link ? "Déposé" : "Aucun"}
                      </span>
                    </p>
                    <p className="text-[12px] text-[var(--fg-3)]">{row.hint}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-medium text-[var(--fg-2)] transition-colors duration-150 hover:bg-[var(--bg-sunken)]"
                    >
                      <ExternalLink className="size-3.5" strokeWidth={2} />
                      Voir
                    </a>
                  ) : null}
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => fileInputs.current[row.key]?.click()}
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[12px] font-medium text-[var(--fg-1)] transition-colors duration-150 hover:bg-[var(--bg-sunken)] disabled:opacity-50"
                        style={{ borderColor: "var(--border-1)" }}
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                        ) : (
                          <Upload className="size-3.5" strokeWidth={2} />
                        )}
                        {link ? "Remplacer" : "Déposer"}
                      </button>
                      {link ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => removeAsset(row)}
                          aria-label={`Retirer ${row.title}`}
                          className="inline-flex items-center rounded-md p-1.5 text-[var(--fg-3)] transition-colors duration-150 hover:bg-[var(--destructive-soft)] hover:text-[var(--destructive)] disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" strokeWidth={2} />
                        </button>
                      ) : null}
                      <input
                        ref={(el) => {
                          fileInputs.current[row.key] = el;
                        }}
                        type="file"
                        accept={row.accept}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void uploadAsset(row, file);
                        }}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

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
