"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Cake, Mail, MapPin, Pencil, Phone, Tag, X } from "lucide-react";
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
import { DateField } from "@/components/broker/date-field";
import {
  brokerInsuranceTypeLabels,
  brokerInsuranceTypes,
  insuranceTypeLabel,
} from "@/lib/broker/clients";
import type { BrokerClientRow } from "@/types/database";

type ClientType = "individual" | "company";

/** "1985-04-12" → "12/04/1985 · 40 ans". */
function formatBirthDate(value: string | null): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, y, m, d] = match;
  const birth = new Date(Number(y), Number(m) - 1, Number(d));
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return `${d}/${m}/${y} · ${age} ans`;
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md"
        style={{
          background: "var(--brand-navy-50)",
          color: "var(--brand-navy-700)",
          border: "1px solid var(--border-1)",
        }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--fg-4)]">
          {label}
        </p>
        <p className="mt-0.5 break-words text-[13.5px] font-medium text-[var(--fg-1)]">
          {value || <span className="text-[var(--fg-4)]">—</span>}
        </p>
      </div>
    </div>
  );
}

export function ClientInfoEditor({
  client,
  canEdit,
}: {
  client: BrokerClientRow;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const clientType = (client.client_type as ClientType) ?? "individual";

  const [form, setForm] = React.useState({
    firstName: client.first_name ?? "",
    lastName: client.last_name ?? "",
    companyName: client.company_name ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    postalCode: client.postal_code ?? "",
    city: client.city ?? "",
    dateOfBirth: client.date_of_birth ?? "",
    insuranceType: client.insurance_type ?? "",
    notes: client.notes ?? "",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setForm({
      firstName: client.first_name ?? "",
      lastName: client.last_name ?? "",
      companyName: client.company_name ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      address: client.address ?? "",
      postalCode: client.postal_code ?? "",
      city: client.city ?? "",
      dateOfBirth: client.date_of_birth ?? "",
      insuranceType: client.insurance_type ?? "",
      notes: client.notes ?? "",
    });
    setEditing(false);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const res = await fetch(`/api/broker/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName || null,
        lastName: form.lastName || null,
        companyName: form.companyName || null,
        email: form.email || "",
        phone: form.phone || null,
        address: form.address || null,
        postalCode: form.postalCode || null,
        city: form.city || null,
        dateOfBirth: form.dateOfBirth || null,
        insuranceType: form.insuranceType || null,
        notes: form.notes || null,
      }),
    }).catch(() => null);

    const result = (await res?.json().catch(() => null)) as
      | { success?: boolean; message?: string }
      | null;
    setSaving(false);

    if (!res?.ok || !result?.success) {
      toast.error("Modification impossible", { description: result?.message });
      return;
    }
    toast.success("Dossier mis à jour.");
    setEditing(false);
    router.refresh();
  }

  const fullAddress =
    [client.address, client.postal_code, client.city].filter(Boolean).join(", ") ||
    null;

  return (
    <section
      className="rounded-xl border bg-[var(--bg-surface)]"
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b px-5 py-3.5"
        style={{ borderColor: "var(--border-1)" }}
      >
        <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--fg-1)]">
          Informations client
        </h2>
        {canEdit ? (
          editing ? (
            <button
              type="button"
              onClick={reset}
              disabled={saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-sunken)] disabled:opacity-50"
              style={{ borderColor: "var(--border-1)" }}
            >
              <X className="size-3.5" strokeWidth={2} />
              Annuler
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium text-[var(--fg-2)] transition-colors hover:border-[var(--brand-navy-300)] hover:bg-[var(--brand-navy-50)]"
              style={{ borderColor: "var(--border-1)" }}
            >
              <Pencil className="size-3.5" strokeWidth={1.75} />
              Modifier
            </button>
          )
        ) : null}
      </div>

      <div className="px-5 py-3">
        {!editing ? (
          <div className="divide-y" style={{ borderColor: "var(--border-1)" }}>
            <Row
              icon={<Mail className="size-3.5" strokeWidth={1.75} />}
              label="Email"
              value={client.email}
            />
            <Row
              icon={<Phone className="size-3.5" strokeWidth={1.75} />}
              label="Téléphone"
              value={client.phone}
            />
            <Row
              icon={<MapPin className="size-3.5" strokeWidth={1.75} />}
              label="Adresse"
              value={fullAddress}
            />
            {clientType === "individual" ? (
              <Row
                icon={<Cake className="size-3.5" strokeWidth={1.75} />}
                label="Date de naissance"
                value={formatBirthDate(client.date_of_birth)}
              />
            ) : null}
            <Row
              icon={<Tag className="size-3.5" strokeWidth={1.75} />}
              label="Branche"
              value={insuranceTypeLabel(client.insurance_type)}
            />
            {client.notes ? (
              <div className="py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--fg-4)]">
                  Notes internes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-5 text-[var(--fg-2)]">
                  {client.notes}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {clientType === "company" ? (
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Raison sociale</Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={(e) => update("companyName", e.target.value)}
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
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
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input
                  id="postalCode"
                  value={form.postalCode}
                  onChange={(e) => update("postalCode", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                />
              </div>
            </div>

            {clientType === "individual" ? (
              <div className="space-y-1.5">
                <Label htmlFor="dateOfBirth">Date de naissance</Label>
                <DateField
                  id="dateOfBirth"
                  value={form.dateOfBirth}
                  onChange={(iso) => update("dateOfBirth", iso)}
                />
              </div>
            ) : null}

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
                  {brokerInsuranceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {brokerInsuranceTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes internes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={3}
                placeholder="Notes privées sur le dossier (non transmises au client)."
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={reset}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
