"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GeneralSettingsForm() {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Organisation</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Identité, langue et adresse de l’espace de travail.
        </p>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="organization-name">Nom de l’organisation</Label>
          <Input id="organization-name" defaultValue="Atelier Archipel" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="space-slug">Adresse de l’espace</Label>
          <Input id="space-slug" defaultValue="atelier-archipel" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="default-language">Langue par défaut</Label>
          <Input id="default-language" defaultValue="Français" />
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
