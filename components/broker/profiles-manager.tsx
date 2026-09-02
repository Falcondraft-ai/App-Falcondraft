"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Plus, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profileInitials } from "@/lib/broker/profile-format";
import type { BrokerProfileRow } from "@/types/database";

/**
 * Gestion des profils du cabinet.
 *
 * Chaque profil porte une adresse email : c'est elle qui déterminera la boîte
 * analysée pour son briefing et qui permettra de reconnaître ses envois dans un
 * dossier client. Un profil sans adresse fonctionne, il n'aura simplement pas
 * de courrier à lui.
 */
export function ProfilesManager({
  initialProfiles,
}: {
  initialProfiles: BrokerProfileRow[];
}) {
  const router = useRouter();
  const [profiles, setProfiles] = React.useState(initialProfiles);
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({
    displayName: "",
    email: "",
    roleLabel: "",
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !form.displayName.trim()) return;
    setBusy(true);
    const res = await fetch("/api/broker/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | { success?: boolean; message?: string; profile?: BrokerProfileRow }
      | null;
    setBusy(false);

    if (!res?.ok || !data?.success || !data.profile) {
      toast.error("Profil non créé.", {
        description: data?.message ?? "Veuillez réessayer.",
      });
      return;
    }
    setProfiles((prev) => [...prev, data.profile!]);
    setForm({ displayName: "", email: "", roleLabel: "" });
    setAdding(false);
    toast.success(`Profil « ${data.profile.display_name} » créé.`);
    router.refresh();
  }

  async function deactivate(profile: BrokerProfileRow) {
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/broker/profiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: profile.id, isActive: !profile.is_active }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      toast.error("Modification impossible.");
      return;
    }
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === profile.id ? { ...p, is_active: !p.is_active } : p,
      ),
    );
    router.refresh();
  }

  return (
    <section
      className="rounded-lg border bg-[var(--bg-surface)] p-5 sm:p-6"
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="fd-eyebrow">Profils</p>
          <h2 className="fd-serif mt-1 text-[18px] font-semibold tracking-[-0.01em] text-[var(--fg-1)]">
            Qui travaille dans le cabinet
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-6 text-[var(--fg-3)]">
            Un seul identifiant pour tout le cabinet : chacun choisit son profil
            en arrivant. Les dossiers restent communs, mais chacun retrouve sa
            boîte email et signe en son nom.
          </p>
        </div>
        {!adding ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5"
          >
            <Plus className="size-3.5" strokeWidth={1.75} />
            Ajouter
          </Button>
        ) : null}
      </div>

      {adding ? (
        <form
          onSubmit={create}
          className="mt-5 grid gap-3 rounded-lg border p-4 sm:grid-cols-3"
          style={{
            borderColor: "var(--border-1)",
            background: "var(--bg-sunken)",
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="profile-name" className="text-[12px]">
              Nom affiché
            </Label>
            <Input
              id="profile-name"
              value={form.displayName}
              onChange={(e) =>
                setForm((f) => ({ ...f, displayName: e.target.value }))
              }
              placeholder="Frank Stephan"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email" className="text-[12px]">
              Adresse email
            </Label>
            <Input
              id="profile-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="contact@cabinet.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-role" className="text-[12px]">
              Fonction (facultatif)
            </Label>
            <Input
              id="profile-role"
              value={form.roleLabel}
              onChange={(e) =>
                setForm((f) => ({ ...f, roleLabel: e.target.value }))
              }
              placeholder="Courtier"
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-3">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
              ) : null}
              Créer le profil
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAdding(false)}
            >
              Annuler
            </Button>
          </div>
        </form>
      ) : null}

      {profiles.length === 0 && !adding ? (
        <p className="mt-5 text-[13px] text-[var(--fg-3)]">
          Aucun profil pour l’instant. Sans profil, tout le monde travaille sous
          le compte du cabinet — ajoutez-en un par personne pour séparer les
          boîtes email et les signatures.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {profiles.map((profile) => (
            <li
              key={profile.id}
              className="flex items-center gap-3 rounded-lg border px-3.5 py-3"
              style={{
                borderColor: "var(--border-1)",
                opacity: profile.is_active ? 1 : 0.55,
              }}
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-[12px] font-semibold ring-1 ring-white/10"
                style={{
                  background: "linear-gradient(155deg, #283450, #181f31)",
                  color: "var(--accent)",
                }}
              >
                {profileInitials(profile.display_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-[var(--fg-1)]">
                  {profile.display_name}
                  {profile.role_label ? (
                    <span className="ml-2 font-normal text-[var(--fg-3)]">
                      {profile.role_label}
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-[12px] text-[var(--fg-3)]">
                  {profile.email ?? "Aucune adresse email associée"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void deactivate(profile)}
                title={
                  profile.is_active
                    ? "Retirer ce profil du sélecteur"
                    : "Remettre ce profil dans le sélecteur"
                }
              >
                {profile.is_active ? (
                  <X className="size-3.5" strokeWidth={1.75} />
                ) : (
                  <UserRound className="size-3.5" strokeWidth={1.75} />
                )}
                {profile.is_active ? "Désactiver" : "Réactiver"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
