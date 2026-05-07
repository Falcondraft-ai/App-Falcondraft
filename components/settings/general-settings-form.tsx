"use client";

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

export function GeneralSettingsForm({
  organizationName,
  organizationSlug,
  defaultLanguage,
}: {
  organizationName: string;
  organizationSlug: string;
  defaultLanguage: string;
}) {
  return (
    <section className="border bg-card/80">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Organisation</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Identité, langue et adresse de l’espace de travail.
        </p>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="organization-name">Nom de l’organisation</Label>
          <Input id="organization-name" defaultValue={organizationName} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="space-slug">Adresse de l’espace</Label>
          <Input id="space-slug" defaultValue={organizationSlug} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="default-language">Langue par défaut</Label>
          <Select defaultValue={defaultLanguage}>
            <SelectTrigger id="default-language" className="w-full">
              <SelectValue placeholder="Sélectionner une langue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Français">Français</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end border-t p-4">
        <Button
          type="button"
          onClick={() => {
            toast.success("Paramètres enregistrés.");
          }}
        >
          Enregistrer
        </Button>
      </div>
    </section>
  );
}
