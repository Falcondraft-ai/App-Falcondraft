"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  brokerClientTypeHints,
  brokerClientTypeLabels,
  brokerClientTypes,
  isNamedByCompany,
  type BrokerClientType,
} from "@/lib/broker/clients";

export type CreatedClient = { id: string; name: string; type?: string };

/**
 * Découpe « Marie Durand » en prénom / nom.
 *
 * Approximation assumée : le dernier mot fait le nom, le reste le prénom. Le
 * nom d'un dossier n'est qu'un repère interne, et il se corrige en un clic
 * depuis l'en-tête du dossier.
 */
function splitName(raw: string): { first: string; last: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: "", last: parts[0]! };
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1)! };
}

/** Un expéditeur en « Prénom NOM » se devine mal ; une adresse, jamais. */
function looksLikeCompany(name: string): boolean {
  return /\b(sa|sas|sarl|sasu|eurl|sci|gie|mutuelle|assurances?|group(e)?|cie|compagnie)\b/i.test(
    name,
  );
}

/**
 * Ouvre un dossier sans quitter l'écran où l'on se trouve.
 *
 * Le courtier tombe sur un email dont l'expéditeur n'a pas de dossier : jusqu'à
 * présent il devait sortir du briefing, créer le dossier, revenir, et retrouver
 * son email. Ce dialogue fait le strict nécessaire — nom, type, coordonnées
 * connues — et rend le dossier créé à l'appelant, qui enchaîne aussitôt sur le
 * rangement. Le reste de la fiche se complète plus tard, dans le dossier.
 */
export function QuickClientDialog({
  open,
  onOpenChange,
  defaultName,
  defaultEmail,
  defaultType = "individual",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nom pressenti — la recherche saisie, ou le nom de l'expéditeur. */
  defaultName?: string;
  defaultEmail?: string;
  defaultType?: BrokerClientType;
  onCreated: (client: CreatedClient) => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [type, setType] = React.useState<BrokerClientType>(defaultType);
  const [first, setFirst] = React.useState("");
  const [last, setLast] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");

  // Re-préremplissage à chaque ouverture : le dialogue reste monté entre deux
  // usages, et il doit repartir du contexte courant, pas de la saisie passée.
  React.useEffect(() => {
    if (!open) return;
    const name = defaultName?.trim() ?? "";
    const guessed: BrokerClientType =
      defaultType !== "individual"
        ? defaultType
        : looksLikeCompany(name)
          ? "company"
          : "individual";
    setType(guessed);
    const { first: f, last: l } = splitName(name);
    setFirst(f);
    setLast(l);
    setCompany(name);
    setEmail(defaultEmail?.trim() ?? "");
    setPhone("");
  }, [open, defaultName, defaultEmail, defaultType]);

  const byCompany = isNamedByCompany(type);
  const valid = byCompany
    ? company.trim().length > 0
    : first.trim().length > 0 || last.trim().length > 0;

  async function submit() {
    if (saving || !valid) return;
    setSaving(true);
    try {
      const res = await fetch("/api/broker/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientType: type,
          firstName: byCompany ? null : first.trim() || null,
          lastName: byCompany ? null : last.trim() || null,
          companyName: byCompany ? company.trim() : null,
          email: email.trim(),
          phone: phone.trim() || null,
        }),
      }).catch(() => null);

      const data = (await res?.json().catch(() => null)) as
        | { success?: boolean; message?: string; client?: CreatedClient }
        | null;

      if (!res?.ok || !data?.success || !data.client) {
        toast.error("Dossier non créé.", {
          description: data?.message ?? "Veuillez réessayer.",
        });
        return;
      }

      onOpenChange(false);
      onCreated(data.client);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un dossier</DialogTitle>
          <DialogDescription>
            Le strict nécessaire pour ouvrir le dossier — vous le compléterez
            ensuite. Ce que vous étiez en train de ranger y sera classé
            directement.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4 py-1"
        >
          <div className="space-y-1.5">
            <Label>Type de dossier</Label>
            {/* `flex-wrap` plutôt qu'une grille rigide : sur un écran étroit,
                trois colonnes écraseraient les libellés. */}
            <div className="flex flex-wrap gap-2">
              {brokerClientTypes.map((option) => {
                const active = type === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setType(option)}
                    title={brokerClientTypeHints[option]}
                    className="min-w-[92px] flex-1 rounded-md border px-3 py-2 text-[12.5px] font-medium transition-colors"
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
                    {brokerClientTypeLabels[option]}
                  </button>
                );
              })}
            </div>
            <p className="text-[11.5px] text-[var(--fg-4)]">
              {brokerClientTypeHints[type]}
            </p>
          </div>

          {byCompany ? (
            <div className="space-y-1.5">
              <Label htmlFor="quick-company">
                {type === "carrier" ? "Nom de la compagnie" : "Raison sociale"}
              </Label>
              <Input
                id="quick-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={
                  type === "carrier" ? "Ex. Generali" : "Ex. Boulangerie Martin"
                }
                autoFocus
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quick-first">Prénom</Label>
                <Input
                  id="quick-first"
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                  placeholder="Marie"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-last">Nom</Label>
                <Input
                  id="quick-last"
                  value={last}
                  onChange={(e) => setLast(e.target.value)}
                  placeholder="Durand"
                />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="quick-email">Email</Label>
              <Input
                id="quick-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-phone">Téléphone</Label>
              <Input
                id="quick-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="06 12 34 56 78"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={saving || !valid}
              className="gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  Création…
                </>
              ) : (
                "Créer et ranger"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
