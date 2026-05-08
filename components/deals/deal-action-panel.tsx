"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const dealActions = [
  {
    label: "Générer le compte-rendu",
    message: "Compte-rendu ajouté à la file de préparation.",
  },
  {
    label: "Générer la proposition",
    message: "Préparation de la proposition demandée.",
  },
  {
    label: "Valider la proposition",
    message: "Proposition marquée comme validée.",
  },
  {
    label: "Créer le document final",
    message: "Document final placé en préparation.",
  },
  {
    label: "Générer le lien de signature",
    message: "Lien de signature prêt à vérifier.",
  },
  {
    label: "Préparer le brouillon email",
    message: "Brouillon email préparé.",
  },
  {
    label: "Télécharger le PDF final",
    message: "PDF final prêt au téléchargement.",
  },
  {
    label: "Ouvrir le lien de signature",
    message: "Lien de signature ouvert.",
  },
] as const;

function handleMockWorkflowAction(label: string, message: string) {
  toast.success(message, {
    description: `${label} · action enregistrée.`,
  });
}

export function DealActionPanel({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [isTriggeringCallSummary, setIsTriggeringCallSummary] =
    React.useState(false);
  const [isDeletingDeal, setIsDeletingDeal] = React.useState(false);

  async function triggerCallSummary() {
    setIsTriggeringCallSummary(true);

    const response = await fetch("/api/workflows/call-summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dealId }),
    }).catch(() => null);

    setIsTriggeringCallSummary(false);

    if (!response?.ok) {
      const result: unknown = await response?.json().catch(() => null);
      const message =
        result &&
        typeof result === "object" &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : "Le compte-rendu n’a pas pu être déclenché.";

      toast.error("Déclenchement impossible", {
        description: message,
      });
      return;
    }

    toast.success("Compte-rendu lancé", {
      description: "La préparation a été transmise au workflow configuré.",
    });
  }

  async function deleteDeal() {
    const confirmed = window.confirm(
      "Supprimer définitivement ce dossier commercial ? Cette action est irréversible.",
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingDeal(true);

    const response = await fetch(`/api/deals/${dealId}`, {
      method: "DELETE",
    }).catch(() => null);

    setIsDeletingDeal(false);

    if (!response?.ok) {
      const result: unknown = await response?.json().catch(() => null);
      const message =
        result &&
        typeof result === "object" &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : "Le dossier commercial n’a pas pu être supprimé.";

      toast.error("Suppression impossible", {
        description: message,
      });
      return;
    }

    toast.success("Dossier commercial supprimé", {
      description: "Retour au pipeline commercial.",
    });
    router.replace("/dashboard/deals");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {dealActions.map((action, index) => (
        <Button
          key={action.label}
          type="button"
          variant={index === 0 ? "default" : "outline"}
          className="w-full justify-start"
          disabled={
            isDeletingDeal || (index === 0 && isTriggeringCallSummary)
          }
          onClick={() => {
            if (index === 0) {
              void triggerCallSummary();
              return;
            }

            handleMockWorkflowAction(action.label, action.message);
          }}
        >
          {index === 0 && isTriggeringCallSummary
            ? "Déclenchement..."
            : action.label}
        </Button>
      ))}
      <div className="pt-3">
        <Button
          type="button"
          variant="destructive"
          className="w-full justify-start"
          disabled={isDeletingDeal || isTriggeringCallSummary}
          onClick={() => void deleteDeal()}
        >
          {isDeletingDeal ? "Suppression..." : "Supprimer le dossier"}
        </Button>
      </div>
    </div>
  );
}
