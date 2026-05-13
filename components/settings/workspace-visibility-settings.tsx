"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type WorkspaceVisibilitySettingsProps = {
  initialAllowMemberCompanyVisibility: boolean;
};

type VisibilityApiResponse =
  | {
      success: true;
      allow_member_company_visibility: boolean;
    }
  | {
      success: false;
      message: string;
    };

export function WorkspaceVisibilitySettings({
  initialAllowMemberCompanyVisibility,
}: WorkspaceVisibilitySettingsProps) {
  const [allowMemberCompanyVisibility, setAllowMemberCompanyVisibility] =
    React.useState(initialAllowMemberCompanyVisibility);
  const [isSaving, setIsSaving] = React.useState(false);

  async function saveVisibilityPreference() {
    setIsSaving(true);

    const response = await fetch("/api/organization-settings/visibility", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        allow_member_company_visibility: allowMemberCompanyVisibility,
      }),
    });
    const result = (await response.json().catch(() => ({
      success: false,
      message: "Mise à jour impossible.",
    }))) as VisibilityApiResponse;

    setIsSaving(false);

    if (!response.ok || !result.success) {
      const message =
        "message" in result ? result.message : "Mise à jour impossible.";
      toast.error("Préférence non enregistrée", {
        description: message,
      });
      return;
    }

    setAllowMemberCompanyVisibility(result.allow_member_company_visibility);
    toast.success("Visibilité mise à jour", {
      description: result.allow_member_company_visibility
        ? "Les collaborateurs peuvent ouvrir les vues entreprise."
        : "Les collaborateurs voient uniquement leurs dossiers et documents.",
    });
  }

  return (
    <section className="bg-card/80 rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Visibilité équipe</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Contrôlez l’accès des collaborateurs aux vues globales dossiers et
          documents.
        </p>
      </div>
      <div className="space-y-4 p-4">
        <label
          htmlFor="allow-member-company-visibility"
          className="bg-secondary/30 flex items-start gap-3 rounded-md border p-3"
        >
          <input
            id="allow-member-company-visibility"
            type="checkbox"
            className="accent-primary mt-1 size-4"
            checked={allowMemberCompanyVisibility}
            onChange={(event) =>
              setAllowMemberCompanyVisibility(event.target.checked)
            }
          />
          <span>
            <span className="block text-sm font-medium">
              Autoriser les vues “Toute l’entreprise”
            </span>
            <span className="text-muted-foreground mt-1 block text-sm leading-5">
              Quand cette option est désactivée, les collaborateurs ne voient
              plus l’onglet entreprise et accèdent uniquement à leurs propres
              dossiers et documents. Les gestionnaires conservent la vue
              globale.
            </span>
          </span>
        </label>
      </div>
      <div className="flex justify-end border-t p-4">
        <Button
          type="button"
          onClick={saveVisibilityPreference}
          disabled={isSaving}
        >
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </section>
  );
}
