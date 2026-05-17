"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { LoadingDots } from "@/components/common/loading-dots";
import { GeneratedDocumentButtons } from "@/components/deals/generated-documents-panel";
import { ProposalValidationDialog } from "@/components/deals/proposal-validation-dialog";
import { useI18n } from "@/components/i18n/language-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  CALL_SUMMARY_GENERATION_EVENT,
  EMAIL_DRAFT_GENERATION_EVENT,
  getCallSummaryGenerationStorageKey,
  getEmailDraftGenerationStorageKey,
  getProposalGenerationStorageKey,
  getProposalValidationStorageKey,
  PROPOSAL_GENERATION_EVENT,
  PROPOSAL_VALIDATION_EVENT,
} from "@/lib/workflow-progress";
import { cn } from "@/lib/utils";
import type { DealStatus } from "@/types/deal";
import type { GeneratedDealDocument } from "@/types/document";

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
    kind: "download-quote",
    label: "Télécharger le devis",
    message: "Devis prêt au téléchargement.",
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

function getLocalizedWorkflowError(message: string, language: "fr" | "en") {
  if (language !== "en") {
    return message;
  }

  const knownMessages: Record<string, string> = {
    "Connectez Gmail ou Outlook avant de créer un brouillon.":
      "Connect Gmail or Outlook before creating a draft.",
    "Vérification de la connexion email impossible.":
      "Email connection could not be checked.",
    "Validez d’abord la proposition pour générer le document final.":
      "Approve the proposal first to generate the final document.",
    "Le déclenchement du workflow a échoué.":
      "The workflow could not be started.",
    "Configuration du workflow introuvable.":
      "Workflow configuration was not found.",
    "Dossier commercial introuvable.": "Deal not found.",
    "Votre rôle ne permet pas de modifier ce dossier.":
      "Your role does not allow you to modify this deal.",
  };

  return knownMessages[message] ?? message;
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
    return 7;
  }

  if (status === "signature_ready") {
    return 7;
  }

  if (status === "final_document_ready") {
    return 5;
  }

  if (status === "final_document_generating") {
    return 4;
  }

  if (
    hasProposal ||
    status === "proposal_ready" ||
    status === "validation_pending"
  ) {
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
  proposalEditUrl,
  quoteDocument,
  finalDocument,
}: {
  dealId: string;
  status: DealStatus;
  hasCallSummary: boolean;
  hasProposal: boolean;
  proposalEditUrl?: string;
  quoteDocument?: GeneratedDealDocument;
  finalDocument?: GeneratedDealDocument;
}) {
  const router = useRouter();
  const { language, t } = useI18n();
  const [isTriggeringCallSummary, setIsTriggeringCallSummary] =
    React.useState(false);
  const [isTriggeringProposal, setIsTriggeringProposal] = React.useState(false);
  const [isTriggeringEmailDraft, setIsTriggeringEmailDraft] =
    React.useState(false);
  const [isCallSummaryGenerating, setIsCallSummaryGenerating] =
    React.useState(false);
  const [isProposalGenerating, setIsProposalGenerating] = React.useState(false);
  const [isProposalValidationGenerating, setIsProposalValidationGenerating] =
    React.useState(false);
  const [isDeletingDeal, setIsDeletingDeal] = React.useState(false);
  const [isArchivingDeal, setIsArchivingDeal] = React.useState(false);
  const [isValidationDialogOpen, setIsValidationDialogOpen] =
    React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = React.useState(false);
  const [localActionIndex, setLocalActionIndex] = React.useState<number | null>(
    null,
  );
  const visibleActionLimit = getVisibleActionLimit(
    status,
    hasCallSummary,
    hasProposal,
  );
  const copy =
    language === "en"
      ? {
          labels: [
            "Generate call summary",
            "Generate proposal",
            "Edit proposal",
            "Approve proposal",
            "Download quote",
            "Download final PDF",
            "Open signature link",
            "Prepare email draft",
          ],
          triggering: "Starting...",
          triggeringShort: "Starting",
          generating: "Generation in progress",
          launching: "Starting",
          processing: "Processing",
          signatureComing: "Signature — feature coming soon",
          callSummaryStartFailed: "Could not start",
          callSummaryStartFallback: "The call summary could not be started.",
          callSummaryStarted: "Call summary started",
          callSummaryStartedDescription:
            "The page will update as soon as it is ready.",
          proposalStartFailed: "Could not start",
          proposalStartFallback: "Proposal generation could not be started.",
          proposalStarted: "Proposal generation started",
          proposalStartedDescription:
            "The deal will update when the proposal is ready.",
          emailDraftStartFailed: "Draft creation failed",
          emailDraftStartFallback: "The Gmail draft could not be started.",
          emailDraftStarted: "Gmail draft creation started",
          emailDraftStartedDescription:
            "The deal will update when the draft is ready.",
          emailDraftReady: "Gmail draft ready",
          emailDraftReadyDescription:
            "The email draft is ready in your connected mailbox.",
          finalDocumentReady: "Final document ready",
          finalDocumentReadyDescription:
            "The final document is now available in the deal.",
          editUnavailable: "Editing link unavailable",
          editUnavailableDescription:
            "The link will be available once the proposal is synchronized.",
          deleteConfirm:
            "Permanently delete this deal? This action cannot be undone.",
          deleteFallback: "The deal could not be deleted.",
          deleteFailed: "Deletion failed",
          deleteSuccess: "Deal deleted",
          deleteSuccessDescription: "Back to the sales pipeline.",
          archiveConfirm:
            "Archive this deal? It will no longer be counted in the pipeline.",
          archiveFallback: "The deal could not be archived.",
          archiveFailed: "Archiving failed",
          archiveSuccess: "Deal archived",
          archiveSuccessDescription:
            "It has been removed from the sales pipeline.",
          next: "Next",
          ready: "Ready",
          validateFirst:
            "Approve the proposal first to generate the final document.",
          archiveLoading: "Archiving...",
          archive: "Archive deal",
          deleteLoading: "Deleting...",
          delete: "Delete deal",
          cancel: "Cancel",
        }
      : {
          labels: dealActions.map((action) => action.label),
          triggering: "Déclenchement...",
          triggeringShort: "Déclenchement",
          generating: "Génération en cours",
          launching: "Lancement",
          processing: "Traitement en cours",
          signatureComing: "Signature — fonctionnalité à venir",
          callSummaryStartFailed: "Déclenchement impossible",
          callSummaryStartFallback:
            "Le compte-rendu n’a pas pu être déclenché.",
          callSummaryStarted: "Compte-rendu lancé",
          callSummaryStartedDescription:
            "La page se mettra à jour dès qu’il sera prêt.",
          proposalStartFailed: "Déclenchement impossible",
          proposalStartFallback:
            "La génération de proposition n’a pas pu être déclenchée.",
          proposalStarted: "Génération de proposition lancée",
          proposalStartedDescription:
            "Le dossier se mettra à jour lorsque la proposition sera prête.",
          emailDraftStartFailed: "Création du brouillon impossible",
          emailDraftStartFallback: "Le brouillon Gmail n’a pas pu être lancé.",
          emailDraftStarted: "Création du brouillon Gmail lancée",
          emailDraftStartedDescription:
            "Le dossier se mettra à jour lorsque le brouillon sera prêt.",
          emailDraftReady: "Brouillon Gmail prêt",
          emailDraftReadyDescription:
            "Le brouillon est prêt dans votre messagerie connectée.",
          finalDocumentReady: "Document final prêt",
          finalDocumentReadyDescription:
            "Le document final est disponible dans le dossier.",
          editUnavailable: "Lien d’édition indisponible",
          editUnavailableDescription:
            "Le lien sera disponible dès que la proposition aura été synchronisée.",
          deleteConfirm:
            "Supprimer définitivement ce dossier commercial ? Cette action est irréversible.",
          deleteFallback: "Le dossier commercial n’a pas pu être supprimé.",
          deleteFailed: "Suppression impossible",
          deleteSuccess: "Dossier commercial supprimé",
          deleteSuccessDescription: "Retour au pipeline commercial.",
          archiveConfirm:
            "Archiver ce dossier commercial ? Il ne sera plus comptabilisé dans le pipeline.",
          archiveFallback: "Le dossier commercial n’a pas pu être archivé.",
          archiveFailed: "Archivage impossible",
          archiveSuccess: "Dossier archivé",
          archiveSuccessDescription: "Il a été retiré du pipeline commercial.",
          next: "Suivant",
          ready: "Prêt",
          validateFirst:
            "Validez d’abord la proposition pour générer le document final.",
          archiveLoading: "Archivage...",
          archive: "Archiver le dossier",
          deleteLoading: "Suppression...",
          delete: "Supprimer le dossier",
          cancel: "Annuler",
        };

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
      window.removeEventListener(
        PROPOSAL_GENERATION_EVENT,
        syncGenerationState,
      );
    };
  }, [dealId, hasProposal, status]);

  React.useEffect(() => {
    const storageKey = getProposalValidationStorageKey(dealId);
    const finalDocumentReady = Boolean(
      finalDocument?.hasStoragePath && finalDocument.status === "ready",
    );

    function syncValidationState() {
      setIsProposalValidationGenerating(
        !finalDocumentReady && Boolean(window.localStorage.getItem(storageKey)),
      );
    }

    if (finalDocumentReady) {
      const hadValidationFlag = Boolean(
        window.localStorage.getItem(storageKey),
      );

      window.localStorage.removeItem(storageKey);
      setIsProposalValidationGenerating(false);

      if (hadValidationFlag) {
        toast.success(copy.finalDocumentReady, {
          description: copy.finalDocumentReadyDescription,
        });
      }

      return;
    }

    syncValidationState();
    window.addEventListener("storage", syncValidationState);
    window.addEventListener(PROPOSAL_VALIDATION_EVENT, syncValidationState);

    return () => {
      window.removeEventListener("storage", syncValidationState);
      window.removeEventListener(
        PROPOSAL_VALIDATION_EVENT,
        syncValidationState,
      );
    };
  }, [
    copy.finalDocumentReady,
    copy.finalDocumentReadyDescription,
    dealId,
    finalDocument,
  ]);

  React.useEffect(() => {
    const storageKey = getEmailDraftGenerationStorageKey(dealId);
    const emailDraftReady =
      status === "email_draft_ready" || status === "completed";

    function syncEmailDraftGenerationState() {
      setIsTriggeringEmailDraft(
        !emailDraftReady && Boolean(window.localStorage.getItem(storageKey)),
      );
    }

    if (emailDraftReady) {
      const hadEmailDraftFlag = Boolean(
        window.localStorage.getItem(storageKey),
      );

      window.localStorage.removeItem(storageKey);
      setIsTriggeringEmailDraft(false);

      if (hadEmailDraftFlag) {
        toast.success(copy.emailDraftReady, {
          description: copy.emailDraftReadyDescription,
        });
      }

      return;
    }

    syncEmailDraftGenerationState();
    window.addEventListener("storage", syncEmailDraftGenerationState);
    window.addEventListener(
      EMAIL_DRAFT_GENERATION_EVENT,
      syncEmailDraftGenerationState,
    );

    return () => {
      window.removeEventListener("storage", syncEmailDraftGenerationState);
      window.removeEventListener(
        EMAIL_DRAFT_GENERATION_EVENT,
        syncEmailDraftGenerationState,
      );
    };
  }, [copy.emailDraftReady, copy.emailDraftReadyDescription, dealId, status]);

  React.useEffect(() => {
    const emailDraftReady =
      status === "email_draft_ready" || status === "completed";

    if (!isTriggeringEmailDraft || emailDraftReady) {
      return;
    }

    const interval = window.setInterval(() => {
      router.refresh();
    }, 3500);

    return () => window.clearInterval(interval);
  }, [isTriggeringEmailDraft, router, status]);

  React.useEffect(() => {
    if (!isProposalValidationGenerating) {
      return;
    }

    const interval = window.setInterval(() => {
      router.refresh();
    }, 3500);

    return () => window.clearInterval(interval);
  }, [isProposalValidationGenerating, router]);

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
          : copy.callSummaryStartFallback;
      const localizedMessage = getLocalizedWorkflowError(message, language);

      toast.error(copy.callSummaryStartFailed, {
        description: localizedMessage,
      });
      return;
    }

    toast.success(copy.callSummaryStarted, {
      description: copy.callSummaryStartedDescription,
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
          : copy.proposalStartFallback;
      const localizedMessage = getLocalizedWorkflowError(message, language);

      toast.error(copy.proposalStartFailed, {
        description: localizedMessage,
      });
      return;
    }

    toast.success(copy.proposalStarted, {
      description: copy.proposalStartedDescription,
    });
    window.localStorage.setItem(
      getProposalGenerationStorageKey(dealId),
      new Date().toISOString(),
    );
    window.dispatchEvent(new Event(PROPOSAL_GENERATION_EVENT));
    setIsProposalGenerating(true);
    router.refresh();
  }

  async function triggerEmailDraftGeneration() {
    setIsTriggeringEmailDraft(true);

    const response = await fetch("/api/workflows/email-draft-generation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dealId }),
    }).catch(() => null);

    setIsTriggeringEmailDraft(false);

    if (!response?.ok) {
      const result: unknown = await response?.json().catch(() => null);
      const message =
        result &&
        typeof result === "object" &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : copy.emailDraftStartFallback;
      const localizedMessage = getLocalizedWorkflowError(message, language);

      toast.error(copy.emailDraftStartFailed, {
        description: localizedMessage,
      });
      return;
    }

    toast.success(copy.emailDraftStarted, {
      description: copy.emailDraftStartedDescription,
    });
    window.localStorage.setItem(
      getEmailDraftGenerationStorageKey(dealId),
      new Date().toISOString(),
    );
    window.dispatchEvent(new Event(EMAIL_DRAFT_GENERATION_EVENT));
    router.refresh();
  }

  function runLocalAction(index: number, label: string, message: string) {
    setLocalActionIndex(index);

    window.setTimeout(() => {
      setLocalActionIndex(null);
      handleMockWorkflowAction(label, message);
    }, 650);
  }

  function openProposalEditor() {
    if (!proposalEditUrl) {
      toast.error(copy.editUnavailable, {
        description: copy.editUnavailableDescription,
      });
      return;
    }

    window.open(proposalEditUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteDeal() {
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
          : copy.deleteFallback;

      toast.error(copy.deleteFailed, {
        description: message,
      });
      return;
    }

    toast.success(copy.deleteSuccess, {
      description: copy.deleteSuccessDescription,
    });
    router.replace("/dashboard/deals");
    router.refresh();
  }

  async function archiveDeal() {
    setIsArchivingDeal(true);

    const response = await fetch(`/api/deals/${dealId}/archive`, {
      method: "PATCH",
    }).catch(() => null);

    setIsArchivingDeal(false);

    if (!response?.ok) {
      const result: unknown = await response?.json().catch(() => null);
      const message =
        result &&
        typeof result === "object" &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : copy.archiveFallback;

      toast.error(copy.archiveFailed, {
        description: message,
      });
      return;
    }

    toast.success(copy.archiveSuccess, {
      description: copy.archiveSuccessDescription,
    });
    router.replace("/dashboard/deals");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {dealActions.map((action, index) => {
        const hasReadyFinalDocument = Boolean(
          finalDocument?.hasStoragePath && finalDocument.status === "ready",
        );
        const isDocumentActionAvailable =
          (action.kind === "download-quote" && Boolean(quoteDocument)) ||
          (action.kind === "download-final-pdf" && Boolean(finalDocument));
        const isSignatureAction = action.kind === "open-signature-link";
        const isEmailDraftAction = action.kind === "prepare-email-draft";
        const isAvailable =
          !isSignatureAction &&
          (isEmailDraftAction
            ? hasReadyFinalDocument
            : index <= visibleActionLimit || isDocumentActionAvailable);
        const isNextAction = index === visibleActionLimit;

        if (action.kind === "download-quote") {
          return (
            <GeneratedDocumentButtons
              key={action.label}
              document={quoteDocument}
              compact
              fullWidth
              showOpen={false}
              downloadLabel={t("common.actions.downloadQuote")}
            />
          );
        }

        if (action.kind === "download-final-pdf") {
          return (
            <GeneratedDocumentButtons
              key={action.label}
              document={finalDocument}
              compact
              fullWidth
              showOpen={false}
              downloadLabel={t("common.actions.downloadFinalDocument")}
            />
          );
        }

        const button = (
          <Button
            key={action.label}
            type="button"
            variant={isAvailable ? "default" : "outline"}
            className={cn(
              "w-full justify-between gap-3",
              isSignatureAction
                ? "bg-muted/30 text-muted-foreground border-dashed opacity-100"
                : "",
              isAvailable && !isNextAction
                ? "bg-primary/88 hover:bg-primary/82"
                : "",
            )}
            disabled={
              !isAvailable ||
              isSignatureAction ||
              isDeletingDeal ||
              (index === 0 &&
                (isTriggeringCallSummary || isCallSummaryGenerating)) ||
              (index === 1 && (isTriggeringProposal || isProposalGenerating)) ||
              isTriggeringEmailDraft ||
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

              if (action.kind === "edit-proposal") {
                openProposalEditor();
                return;
              }

              if (action.kind === "validate-proposal") {
                setIsValidationDialogOpen(true);
                return;
              }

              if (isEmailDraftAction) {
                void triggerEmailDraftGeneration();
                return;
              }

              runLocalAction(index, action.label, action.message);
            }}
          >
            <span className="truncate text-left">
              {index === 0 && isTriggeringCallSummary ? (
                copy.triggering
              ) : index === 0 && isCallSummaryGenerating ? (
                <>
                  {copy.generating}
                  <LoadingDots />
                </>
              ) : index === 1 && isTriggeringProposal ? (
                <>
                  {copy.triggeringShort}
                  <LoadingDots />
                </>
              ) : index === 1 && isProposalGenerating ? (
                <>
                  {copy.generating}
                  <LoadingDots />
                </>
              ) : isEmailDraftAction && isTriggeringEmailDraft ? (
                <>
                  {copy.launching}
                  <LoadingDots />
                </>
              ) : localActionIndex === index ? (
                <>
                  {copy.processing}
                  <LoadingDots />
                </>
              ) : isSignatureAction ? (
                copy.signatureComing
              ) : (
                copy.labels[index]
              )}
            </span>
            {isAvailable &&
            !isCallSummaryGenerating &&
            !isTriggeringProposal &&
            !isProposalGenerating &&
            !isTriggeringEmailDraft &&
            localActionIndex === null ? (
              <span className="text-[10px] font-medium tracking-[0.12em] uppercase opacity-70">
                {isNextAction ? copy.next : copy.ready}
              </span>
            ) : null}
          </Button>
        );

        if (!isEmailDraftAction || hasReadyFinalDocument) {
          return button;
        }

        return (
          <div key={action.label} className="space-y-1.5">
            {button}
            <p className="text-muted-foreground px-1 text-xs leading-5">
              {copy.validateFirst}
            </p>
          </div>
        );
      })}
      <div className="space-y-2 pt-3">
        <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            disabled={isArchivingDeal || isDeletingDeal || isTriggeringCallSummary || isCallSummaryGenerating || isTriggeringProposal || isProposalGenerating || isTriggeringEmailDraft || localActionIndex !== null}
            onClick={() => setArchiveDialogOpen(true)}
          >
            {isArchivingDeal ? copy.archiveLoading : copy.archive}
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{copy.archive}</AlertDialogTitle>
              <AlertDialogDescription>{copy.archiveConfirm}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={() => void archiveDeal()}>
                {isArchivingDeal ? copy.archiveLoading : copy.archive}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <Button
            type="button"
            variant="destructive"
            className="w-full justify-start"
            disabled={isDeletingDeal || isArchivingDeal || isTriggeringCallSummary || isCallSummaryGenerating || isTriggeringProposal || isProposalGenerating || isTriggeringEmailDraft || localActionIndex !== null}
            onClick={() => setDeleteDialogOpen(true)}
          >
            {isDeletingDeal ? copy.deleteLoading : copy.delete}
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{copy.delete}</AlertDialogTitle>
              <AlertDialogDescription>{copy.deleteConfirm}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={() => void deleteDeal()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isDeletingDeal ? copy.deleteLoading : copy.delete}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <ProposalValidationDialog
        dealId={dealId}
        open={isValidationDialogOpen}
        onOpenChange={setIsValidationDialogOpen}
      />
    </div>
  );
}
