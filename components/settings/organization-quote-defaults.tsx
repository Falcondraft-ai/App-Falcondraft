"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OrganizationQuoteDefaultsProps {
  initialDefaultQuoteClientType: string;
  initialDefaultQuoteTaxRate: number;
}

export function OrganizationQuoteDefaults({
  initialDefaultQuoteClientType,
  initialDefaultQuoteTaxRate,
}: OrganizationQuoteDefaultsProps) {
  const [clientType, setClientType] = React.useState(
    initialDefaultQuoteClientType,
  );
  const [taxRate, setTaxRate] = React.useState(
    String(initialDefaultQuoteTaxRate),
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const hasChanges =
    clientType !== initialDefaultQuoteClientType ||
    Number(taxRate) !== initialDefaultQuoteTaxRate;

  async function handleSave() {
    setIsSaving(true);

    const response = await fetch(
      "/api/organization-settings/quote-defaults",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_quote_client_type: clientType,
          default_quote_tax_rate: Number(taxRate),
        }),
      },
    ).catch(() => null);

    setIsSaving(false);

    if (!response?.ok) {
      toast.error("Mise a jour impossible.", {
        description:
          "Verifiez les parametres puis reessayez.",
      });
      return;
    }

    toast.success("Preferences enregistrees.", {
      description:
        "Les valeurs par defaut pour les devis sont a jour.",
    });
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Parametres devis par defaut
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Ces valeurs seront pre-remplies lors de la creation d&apos;un
            nouveau dossier commercial.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Type de client par defaut pour les devis
          </label>
          <Select value={clientType} onValueChange={setClientType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="company">Entreprise</SelectItem>
              <SelectItem value="individual">Particulier</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Taux de TVA par defaut pour les devis
          </label>
          <Select value={taxRate} onValueChange={setTaxRate}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0 %</SelectItem>
              <SelectItem value="5.5">5,5 %</SelectItem>
              <SelectItem value="10">10 %</SelectItem>
              <SelectItem value="20">20 %</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
