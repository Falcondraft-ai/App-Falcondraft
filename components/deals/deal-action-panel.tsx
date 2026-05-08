"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { LoadingDots } from "@/components/common/loading-dots";
import { Button } from "@/components/ui/button";
import {
  CALL_SUMMARY_GENERATION_EVENT,
  getCallSummaryGenerationStorageKey,
  getProposalGenerationStorageKey,
  PROPOSAL_GENERATION_EVENT,
} from "@/lib/workflow-progress";
import { cn } from "@/lib/utils";
import type { DealStatus } from "@/types/deal";

const dealActions = [
  {
    kind: "call-summary",
    label: "Générer le compte-rendu",
    message: "Compte-rendu ajouté à la file de préparation.",
  },
  {
    kind: "proposal-generation",
    label: "Générer la proposition",
    message: "Préparation de la proposition demandée.",
  },
  {
    kind: "edit-proposal",
    label: "Éditer la proposition",
    message: "Lien d’édition à ouvrir dans la section proposition.",
  },
  {
    kind: "validate-proposal",
    label: "Valider la proposition",
    message: "Proposition marquée comme validée.",
  },
  {
    kind: "download-final-pdf",
    label: "Télécharger le PDF final",
    message: "PDF final prêt au téléchargement.",
  },
  {
    kind: "open-signature-link",
    label: "Ouvrir le lien de signature",
    message: "Lien de signature ouvert.",
  },
  {
    kind: "prepare-email-draft",
    label: "Préparer le brouillon email",
    message: "Brouillon email préparé.",
  },
] as const;

function handleMockWorkflowAction(label: string, message: string) {
  toast.success(message, {
    description: `${label} · action enregistrée.`,
  });
}

function getVisibleActionLimit(
  status: DealStatus,
  hasCallSummary: boolean,
  hasProposal: boolean,
) {
  if (status === "completed") {
    return dealActions.length - 1;
  }

  if (status === "email_draft_ready") {
    return 6;
  }

  if (status === "signature_ready") {
    return 6;
  }

  if (status === "final_document_ready") {
    return 5;
  }

  if (status === "final_document_generating") {
    return 4;
  }

  if (hasProposal || status === "proposal_ready" || status === "validation_pending") {
    return 3;
  }

  if (
    hasCallSummary ||
    status === "call_summary_ready" ||
    status === "proposal_generating"
  ) {
    return 1;
  }

  return 0;
}

export function DealActionPanel({
  dealId,
  status,
  hasCallSummary,
  hasProposal,
}: {
  dealId: string;
  status: DealStatus;
  hasCallSummary: boolean;
  hasProposal: boolean;
}) {
  const router = useRouter();
  const [isTriggeringCallSummary, setIsTriggeringCallSummary] =
    React.useState(false);
  const [isTriggeringProposal, setIsTriggeringProposal] = React.useState(false);
  const [isCallSummaryGenerating, setIsCallSummaryGenerating] =
    React.useState(false);
  const [isProposalGenerating, setIsProposalGenerating] = React.useState(false);
  const [isDeletingDeal, setIsDeletingDeal] = React.useState(false);
  const [localActionIndex, setLocalActionIndex] = React.useState<number | null>(
    null,
  );
  const visibleActionLimit = getVisibleActionLimit(
    status,
    hasCallSummary,
    hasProposal,
  );

  React.useEffect(() => {
    const storageKey = getCallSummaryGenerationStorageKey(dealId);

    function syncGenerationState() {
      setIsCallSummaryGenerating(
        !hasCallSummary && Boolean(window.localStorage.getItem(storageKey)),
      );
    }

    if (hasCallSummary) {
      window.localStorage.removeItem(storageKey);
      setIsCallSummaryGenerating(false);
      return;
    }

    syncGenerationState();
    window.addEventListener("storage", syncGenerationState);
    window.addEventListener(CALL_SUMMARY_GENERATION_EVENT, syncGenerationState);

    return () => {
      window.removeEventListener("storage", syncGenerationState);
      window.removeEventListener(
        CALL_SUMMARY_GENERATION_EVENT,
        syncGenerationState,
      );
    };
  }, [dealId, hasCallSummary]);

  React.useEffect(() => {
    const storageKey = getProposalGenerationStorageKey(dealId);

    function syncGenerationState() {
      setIsProposalGenerating(
        !hasProposal &&
          (status === "proposal_generating" ||
            Boolean(window.localStorage.getItem(storageKey))),
      );
    }

    if (hasProposal) {
      window.localStorage.removeItem(storageKey);
      setIsProposalGenerating(false);
      return;
    }

    syncGenerationState();
    window.addEventListener("storage", syncGenerationState);
    window.addEventListener(PROPOSAL_GENERATION_EVENT, syncGenerationState);

    return () => {
      window.removeEventListener("storage", syncGenerationState);
      window.removeEventListener(PROPOSAL_GENERATION_EVENT, syncGenerationState);
    };
  }, [dealId, hasProposal, status]);

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
      description: "La page se mettra à jour dès qu’il sera prêt.",
    });
    window.localStorage.setItem(
      getCallSummaryGenerationStorageKey(dealId),
      new Date().toISOString(),
    );
    window.dispatchEvent(new Event(CALL_SUMMARY_GENERATION_EVENT));
    setIsCallSummaryGenerating(true);
    router.refresh();
  }

  async function triggerProposalGeneration() {
    setIsTriggeringProposal(true);

    const response = await fetch("/api/workflows/proposal-generation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dealId }),
    }).catch(() => null);

    setIsTriggeringProposal(false);

    if (!response?.ok) {
      const result: unknown = await response?.json().catch(() => null);
      const message =
        result &&
        typeof result === "object" &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : "La génération de proposition n’a pas pu être déclenchée.";

      toast.error("Déclenchement impossible", {
        description: message,
      });
      return;
    }

    toast.success("Génération de proposition lancée", {
      description: "Le dossier se mettra à jour lorsque la proposition sera prête.",
    });
    window.localStorage.setItem(
      getProposalGenerationStorageKey(dealId),
      new Date().toISOString(),
    );
    window.dispatchEvent(new Event(PROPOSAL_GENERATION_EVENT));
    setIsProposalGenerating(true);
    router.refresh();
  }

  function runLocalAction(index: number, label: string, message: string) {
    setLocalActionIndex(index);

    window.setTimeout(() => {
      setLocalActionIndex(null);
      handleMockWorkflowAction(label, message);
    }, 650);
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
      {dealActions.map((action, index) => {
        const isAvailable = index <= visibleActionLimit;
        const isNextAction = index === visibleActionLimit;

        return (
          <Button
            key={action.label}
            type="button"
            variant={isAvailable ? "default" : "outline"}
            className={cn(
              "w-full justify-between gap-3",
              isAvailable && !isNextAction
                ? "bg-primary/88 hover:bg-primary/82"
                : "",
            )}
            disabled={
              isDeletingDeal ||
              (index === 0 &&
                (isTriggeringCallSummary || isCallSummaryGenerating)) ||
              (index === 1 &&
                (isTriggeringProposal || isProposalGenerating)) ||
              localActionIndex !== null
            }
            onClick={() => {
              if (index === 0) {
                void triggerCallSummary();
                return;
              }

              if (index === 1) {
                void triggerProposalGeneration();
                return;
              }

              runLocalAction(index, action.label, action.message);
            }}
          >
            <span className="truncate text-left">
              {index === 0 && isTriggeringCallSummary ? (
                "Déclenchement..."
              ) : index === 0 && isCallSummaryGenerating ? (
                <>
                  Génération en cours
                  <LoadingDots />
                </>
              ) : index === 1 && isTriggeringProposal ? (
                <>
                  Déclenchement
                  <LoadingDots />
                </>
              ) : index === 1 && isProposalGenerating ? (
                <>
                  Génération en cours
                  <LoadingDots />
                </>
              ) : localActionIndex === index ? (
                <>
                  Traitement en cours
                  <LoadingDots />
                </>
              ) : (
                action.label
              )}
            </span>
            {isAvailable &&
            !isCallSummaryGenerating &&
            !isTriggeringProposal &&
            !isProposalGenerating &&
            localActionIndex === null ? (
              <span className="text-[10px] font-medium tracking-[0.12em] uppercase opacity-70">
                {isNextAction ? "Suivant" : "Prêt"}
              </span>
            ) : null}
          </Button>
        );
      })}
      <div className="pt-3">
        <Button
          type="button"
          variant="destructive"
          className="w-full justify-start"
          disabled={
            isDeletingDeal ||
            isTriggeringCallSummary ||
            isCallSummaryGenerating ||
            isTriggeringProposal ||
            isProposalGenerating ||
            localActionIndex !== null
          }
          onClick={() => void deleteDeal()}
        >
          {isDeletingDeal ? "Suppression..." : "Supprimer le dossier"}
        </Button>
      </div>
    </div>
  );
}
