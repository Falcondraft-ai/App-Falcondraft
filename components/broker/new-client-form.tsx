"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
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
  brokerInsuranceTypeLabels,
  brokerInsuranceTypes,
  type BrokerInsuranceType,
} from "@/lib/broker/clients";
import { cn } from "@/lib/utils";

type ClientType = "individual" | "company";

type CreateResponse =
  | { success: true; clientId: string }
  | { success: false; message?: string };

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
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function NewClientForm({
  branches = [...brokerInsuranceTypes],
}: {
  branches?: BrokerInsuranceType[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [clientType, setClientType] = React.useState<ClientType>("individual");
  const [form, setForm] = React.useState({
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phone: "",
    address: "",
    postalCode: "",
    city: "",
    insuranceType: "",
    needs: "",
    notes: "",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (clientType === "company" && !form.companyName.trim()) {
      toast.error("Le nom de l’entreprise est requis.");
      return;
    }
    if (
      clientType === "individual" &&
      !form.lastName.trim() &&
      !form.firstName.trim()
    ) {
      toast.error("Le nom du client est requis.");
      return;
    }

    setSubmitting(true);

    const response = await fetch("/api/broker/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientType,
        firstName: form.firstName || null,
        lastName: form.lastName || null,
        companyName: form.companyName || null,
        email: form.email || "",
        phone: form.phone || null,
        address: form.address || null,
        postalCode: form.postalCode || null,
        city: form.city || null,
        insuranceType: form.insuranceType || null,
        needs: form.needs || null,
        notes: form.notes || null,
      }),
    }).catch(() => null);

    const result = (await response?.json().catch(() => null)) as
      | CreateResponse
      | null;

    setSubmitting(false);

    if (!response?.ok || !result?.success) {
      toast.error("Dossier non créé", {
        description:
          (result && "message" in result && result.message) ||
          "Veuillez vérifier les informations et réessayer.",
      });
      return;
    }

    toast.success("Dossier client créé.");
    router.push(`/courtier/clients/${result.clientId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <SectionCard
        title="Type de dossier"
        description="Particulier ou entreprise — cela adapte les informations demandées."
      >
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { key: "individual", label: "Particulier" },
              { key: "company", label: "Entreprise" },
            ] as { key: ClientType; label: string }[]
          ).map((option) => {
            const active = clientType === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setClientType(option.key)}
                className={cn(
                  "rounded-md border px-4 py-3 text-left text-[13px] font-medium transition-colors",
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
                        color: "var(--fg-2)",
                      }
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Identité du client">
        {clientType === "company" ? (
          <div className="space-y-1.5">
            <Label htmlFor="companyName">Raison sociale</Label>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={(event) => update("companyName", event.target.value)}
              placeholder="Ex. Boulangerie Martin SARL"
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(event) => update("firstName", event.target.value)}
                placeholder="Marie"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Nom</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(event) => update("lastName", event.target.value)}
                placeholder="Durand"
              />
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              placeholder="client@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              placeholder="06 12 34 56 78"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address">Adresse</Label>
          <Input
            id="address"
            value={form.address}
            onChange={(event) => update("address", event.target.value)}
            placeholder="12 rue des Lilas"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="postalCode">Code postal</Label>
            <Input
              id="postalCode"
              value={form.postalCode}
              onChange={(event) => update("postalCode", event.target.value)}
              placeholder="75011"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">Ville</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(event) => update("city", event.target.value)}
              placeholder="Paris"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Besoin assurantiel"
        description="La branche et le recueil de besoins serviront de base au devoir de conseil."
      >
        <div className="space-y-1.5">
          <Label>Branche d’assurance</Label>
          <Select
            value={form.insuranceType}
            onValueChange={(value) => update("insuranceType", value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sélectionner une branche" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((type) => (
                <SelectItem key={type} value={type}>
                  {brokerInsuranceTypeLabels[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="needs">Recueil de besoins</Label>
          <Textarea
            id="needs"
            value={form.needs}
            onChange={(event) => update("needs", event.target.value)}
            placeholder="Situation du client, attentes, garanties recherchées, budget…"
            rows={4}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes internes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Notes privées sur le dossier (non transmises au client)."
            rows={3}
          />
        </div>
      </SectionCard>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/courtier/clients")}
          disabled={submitting}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Création…" : "Créer le dossier"}
        </Button>
      </div>
    </form>
  );
}
