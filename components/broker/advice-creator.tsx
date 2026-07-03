"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, PenLine } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateField } from "@/components/broker/date-field";
import type { BrokerClientRow } from "@/types/database";

type CreateResponse =
  | { success: true; adviceId: string }
  | { success: false; message?: string };

/**
 * "Générer le devoir de conseil". If the client's identity is incomplete, opens
 * a dialog to complete it first (so the document never shows a blank line), then
 * generates. Individual PPE is stored on the LCB-FT compliance row.
 */
export function AdviceCreator({
  client,
  pep,
  hasValidatedQuote,
  canEdit,
  alreadyExists = false,
}: {
  client: BrokerClientRow;
  /** "Oui" / "Non" from compliance, or null when not yet recorded. */
  pep: "Oui" | "Non" | null;
  hasValidatedQuote: boolean;
  canEdit: boolean;
  alreadyExists?: boolean;
}) {
  const router = useRouter();
  const clientId = client.id;
  const isCompany = client.client_type === "company";
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    firstName: client.first_name ?? "",
    lastName: client.last_name ?? "",
    companyName: client.company_name ?? "",
    address: client.address ?? "",
    postalCode: client.postal_code ?? "",
    city: client.city ?? "",
    dateOfBirth: client.date_of_birth ?? "",
    birthCountry: client.birth_country ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    pep: pep ?? "",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  // Pre-fill the form with everything already known each time it opens.
  React.useEffect(() => {
    if (!open) return;
    setForm({
      firstName: client.first_name ?? "",
      lastName: client.last_name ?? "",
      companyName: client.company_name ?? "",
      address: client.address ?? "",
      postalCode: client.postal_code ?? "",
      city: client.city ?? "",
      dateOfBirth: client.date_of_birth ?? "",
      birthCountry: client.birth_country ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      pep: pep ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Identity fields shown on the devoir de conseil — missing any → ask first.
  const identityComplete = isCompany
    ? Boolean(
        client.company_name?.trim() &&
          client.address?.trim() &&
          client.email?.trim() &&
          client.phone?.trim(),
      )
    : Boolean(
        client.first_name?.trim() &&
          client.last_name?.trim() &&
          client.address?.trim() &&
          client.date_of_birth &&
          client.birth_country?.trim() &&
          client.email?.trim() &&
          client.phone?.trim() &&
          pep !== null,
      );

  async function doGenerate(): Promise<void> {
    const res = await fetch(`/api/broker/clients/${clientId}/advice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "template" }),
    });
    const data = (await res.json().catch(() => null)) as CreateResponse | null;
    if (!res.ok || !data?.success) {
      toast.error("Création impossible", {
        description: (data && "message" in data && data.message) || undefined,
      });
      return;
    }
    toast.success("Brouillon généré.", {
      description: "Relisez le contenu proposé, puis validez-le.",
    });
    router.push(`/courtier/clients/${clientId}/advice/${data.adviceId}`);
    router.refresh();
  }

  async function onGenerateClick() {
    if (busy) return;
    if (!identityComplete) {
      setOpen(true);
      return;
    }
    setBusy(true);
    try {
      await doGenerate();
    } finally {
      setBusy(false);
    }
  }

  async function saveIdentityThenGenerate() {
    if (busy) return;
    setBusy(true);
    try {
      const clientBody = isCompany
        ? {
            companyName: form.companyName || null,
            address: form.address || null,
            postalCode: form.postalCode || null,
            city: form.city || null,
            email: form.email || null,
            phone: form.phone || null,
          }
        : {
            firstName: form.firstName || null,
            lastName: form.lastName || null,
            address: form.address || null,
            postalCode: form.postalCode || null,
            city: form.city || null,
            dateOfBirth: form.dateOfBirth || null,
            birthCountry: form.birthCountry || null,
            email: form.email || null,
            phone: form.phone || null,
          };
      const clientRes = await fetch(`/api/broker/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientBody),
      }).catch(() => null);
      if (!clientRes?.ok) {
        toast.error("Enregistrement de l’identité impossible.");
        return;
      }
      if (!isCompany && (form.pep === "Oui" || form.pep === "Non")) {
        await fetch(`/api/broker/clients/${clientId}/compliance`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPep: form.pep === "Oui" }),
        }).catch(() => null);
      }
      setOpen(false);
      await doGenerate();
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) return null;

  if (alreadyExists) {
    return (
      <p className="text-[11.5px] text-[var(--fg-3)]">
        Un devoir de conseil existe pour ce dossier. Pour en générer un nouveau,
        supprimez d’abord l’actuel ci-dessous.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={() => void onGenerateClick()}
        disabled={busy}
        className="inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-60"
        style={{
          background: "var(--brand-navy-800)",
          color: "#FFFFFF",
          border: "1px solid var(--brand-navy-800)",
        }}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <PenLine className="size-3.5" strokeWidth={2} />
        )}
        Générer le devoir de conseil
      </button>

      {!hasValidatedQuote ? (
        <p className="w-full text-[11.5px] text-[var(--fg-3)]">
          Astuce : importez un devis compagnie pour pré-remplir la solution
          recommandée.
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compléter l’identité du client</DialogTitle>
            <DialogDescription>
              Ces informations figurent sur le devoir de conseil. Complétez-les
              pour éviter tout champ vide sur le document.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto py-1">
            {isCompany ? (
              <div className="space-y-1.5">
                <Label htmlFor="adv-company">Raison sociale</Label>
                <Input
                  id="adv-company"
                  value={form.companyName}
                  onChange={(e) => update("companyName", e.target.value)}
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="adv-first">Prénom</Label>
                  <Input
                    id="adv-first"
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adv-last">Nom</Label>
                  <Input
                    id="adv-last"
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="adv-address">Adresse</Label>
              <Input
                id="adv-address"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="adv-postal">Code postal</Label>
                <Input
                  id="adv-postal"
                  value={form.postalCode}
                  onChange={(e) => update("postalCode", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adv-city">Ville</Label>
                <Input
                  id="adv-city"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                />
              </div>
            </div>

            {!isCompany ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="adv-dob">Date de naissance</Label>
                    <DateField
                      id="adv-dob"
                      value={form.dateOfBirth}
                      onChange={(iso) => update("dateOfBirth", iso)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="adv-country">Pays de naissance</Label>
                    <Input
                      id="adv-country"
                      value={form.birthCountry}
                      onChange={(e) => update("birthCountry", e.target.value)}
                      placeholder="France"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Personne politiquement exposée</Label>
                  <Select
                    value={form.pep}
                    onValueChange={(value) => update("pep", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="À renseigner (Oui / Non)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Non">Non</SelectItem>
                      <SelectItem value="Oui">Oui</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="adv-email">Email</Label>
                <Input
                  id="adv-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adv-phone">Téléphone</Label>
                <Input
                  id="adv-phone"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => void saveIdentityThenGenerate()}
              disabled={busy}
              className="gap-1.5"
            >
              {busy ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  Génération…
                </>
              ) : (
                "Enregistrer et générer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
