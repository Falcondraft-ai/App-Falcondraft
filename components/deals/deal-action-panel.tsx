"use client";

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

export function DealActionPanel() {
  return (
    <div className="space-y-2">
      {dealActions.map((action, index) => (
        <Button
          key={action.label}
          type="button"
          variant={index === 0 ? "default" : "outline"}
          className="w-full justify-start"
          onClick={() => handleMockWorkflowAction(action.label, action.message)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
