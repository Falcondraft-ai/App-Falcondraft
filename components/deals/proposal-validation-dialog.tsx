"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import {
  getProposalValidationStorageKey,
  PROPOSAL_VALIDATION_EVENT,
} from "@/lib/workflow-progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ProposalValidationSource = "initial_export" | "uploaded_pdf";
type SubmissionPhase = "idle" | "uploading" | "validating";

const validationOptions = [
  {
    mode: "initial_export" as const,
    title: "Valider avec la version initialement générée",
    description:
      "Utiliser le premier export PDF généré pour cette proposition.",
    icon: Check,
  },
  {
    mode: "uploaded_pdf" as const,
    title: "Uploader la dernière version PDF",
    description:
      "Importer le PDF final après vos ajustements dans l’outil d’édition.",
    icon: FileUp,
  },
];

export function ProposalValidationDialog({
  dealId,
  open,
  onOpenChange,
}: {
  dealId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { language } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const [mode, setMode] =
    React.useState<ProposalValidationSource>("initial_export");
  const [file, setFile] = React.useState<File | null>(null);
  const [submissionPhase, setSubmissionPhase] =
    React.useState<SubmissionPhase>("idle");
  const isSubmitting = submissionPhase !== "idle";
  const copy =
    language === "es"
      ? {
          triggerFallback: "No se ha podido iniciar la validación.",
          triggerTitle: "Validación imposible",
          uploadFallback: "No se ha podido subir el PDF.",
          uploadTitle: "Subida imposible",
          pdfRequiredTitle: "PDF requerido",
          pdfRequiredDescription:
            "Añade la última versión en PDF antes de validar.",
          successTitle: "Propuesta comercial validada",
          successDescription:
            "La preparación del documento final ha empezado. Esta página se actualizará automáticamente.",
          title: "Validar la propuesta comercial",
          description: "Elige la versión que debe enviarse a validación final.",
          options: {
            initial_export: {
              title: "Validar la versión generada inicialmente",
              description:
                "Usar la primera exportación PDF generada para esta propuesta comercial.",
            },
            uploaded_pdf: {
              title: "Subir la última versión PDF",
              description:
                "Importar el PDF final después de tus ajustes en la herramienta de edición.",
            },
          },
          cancel: "Cancelar",
          uploading: "Subiendo…",
          validating: "Validando…",
          submit: "Validar esta versión",
          pdfLabel: "PDF de la última versión",
          pdfHelp:
            "El archivo aún puede cambiarse antes de la validación. Solo formato PDF.",
        }
      : language === "en"
        ? {
            triggerFallback: "Validation could not be started.",
            triggerTitle: "Validation failed",
            uploadFallback: "The PDF could not be uploaded.",
            uploadTitle: "Upload failed",
            pdfRequiredTitle: "PDF required",
            pdfRequiredDescription:
              "Add the latest PDF version before approving.",
            successTitle: "Proposal approved",
            successDescription:
              "Final document preparation has started. This page will update automatically.",
            title: "Approve proposal",
            description:
              "Choose the version that should be sent for final validation.",
            options: {
              initial_export: {
                title: "Approve the initially generated version",
                description:
                  "Use the first PDF export generated for this proposal.",
              },
              uploaded_pdf: {
                title: "Upload the latest PDF version",
                description:
                  "Import the final PDF after your edits in the editing tool.",
              },
            },
            cancel: "Cancel",
            uploading: "Uploading...",
            validating: "Validating...",
            submit: "Approve this version",
            pdfLabel: "Latest version PDF",
            pdfHelp:
              "The file can still be changed before approval. PDF format only.",
          }
        : {
            triggerFallback: "La validation n’a pas pu être déclenchée.",
            triggerTitle: "Validation impossible",
            uploadFallback: "Le PDF n’a pas pu être importé.",
            uploadTitle: "Upload impossible",
            pdfRequiredTitle: "PDF requis",
            pdfRequiredDescription:
              "Ajoutez le PDF de la dernière version avant de valider.",
            successTitle: "Proposition validée",
            successDescription:
              "La préparation du document final est lancée. La page se mettra à jour automatiquement.",
            title: "Valider la proposition",
            description:
              "Choisissez la version qui doit être transmise pour validation finale.",
            options: {
              initial_export: {
                title: "Valider avec la version initialement générée",
                description:
                  "Utiliser le premier export PDF généré pour cette proposition.",
              },
              uploaded_pdf: {
                title: "Uploader la dernière version PDF",
                description:
                  "Importer le PDF final après vos ajustements dans l’outil d’édition.",
              },
            },
            cancel: "Annuler",
            uploading: "Upload en cours…",
            validating: "Validation en cours…",
            submit: "Valider cette version",
            pdfLabel: "PDF de la dernière version",
            pdfHelp:
              "Le fichier reste modifiable avant validation. Format PDF uniquement.",
          };

  React.useEffect(() => {
    if (!open) {
      setMode("initial_export");
      setFile(null);
      setSubmissionPhase("idle");
    }
  }, [open]);

  async function triggerValidation(validationSource: ProposalValidationSource) {
    setSubmissionPhase("validating");
    const response = await fetch("/api/workflows/proposal-validation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dealId,
        validationSource,
      }),
    }).catch(() => null);

    if (!response?.ok) {
      const result: unknown = await response?.json().catch(() => null);
      const message =
        result &&
        typeof result === "object" &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : copy.triggerFallback;

      toast.error(copy.triggerTitle, {
        description: message,
      });
      return false;
    }

    return true;
  }

  async function uploadPdf() {
    if (!file) {
      return false;
    }

    const formData = new FormData();
    formData.set("file", file);

    setSubmissionPhase("uploading");
    const response = await fetch(`/api/deals/${dealId}/proposal-pdf`, {
      method: "POST",
      body: formData,
    }).catch(() => null);

    if (!response?.ok) {
      const result: unknown = await response?.json().catch(() => null);
      const message =
        result &&
        typeof result === "object" &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : copy.uploadFallback;

      toast.error(copy.uploadTitle, {
        description: message,
      });
      return false;
    }

    return true;
  }

  async function validateProposal() {
    if (mode === "uploaded_pdf" && !file) {
      toast.error(copy.pdfRequiredTitle, {
        description: copy.pdfRequiredDescription,
      });
      return;
    }

    const uploadReady = mode === "uploaded_pdf" ? await uploadPdf() : true;

    if (!uploadReady) {
      setSubmissionPhase("idle");
      return;
    }

    const validationTriggered = await triggerValidation(mode);
    setSubmissionPhase("idle");

    if (!validationTriggered) {
      return;
    }

    window.localStorage.setItem(
      getProposalValidationStorageKey(dealId),
      new Date().toISOString(),
    );
    window.dispatchEvent(new Event(PROPOSAL_VALIDATION_EVENT));
    toast.success(copy.successTitle, {
      description: copy.successDescription,
    });
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <motion.div
          className="grid gap-3 sm:grid-cols-2"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {validationOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = mode === option.mode;

            return (
              <button
                key={option.mode}
                type="button"
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  "hover:border-primary/55 hover:bg-primary/5",
                  isSelected
                    ? "border-primary/70 bg-primary/10"
                    : "border-border bg-card",
                )}
                onClick={() => setMode(option.mode)}
              >
                <span className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 items-center justify-center rounded-md border",
                      isSelected
                        ? "border-primary/60 bg-primary text-primary-foreground"
                        : "border-border bg-secondary/60 text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">
                      {copy.options[option.mode].title}
                    </span>
                    <span className="text-muted-foreground mt-1 block text-sm leading-5">
                      {copy.options[option.mode].description}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </motion.div>

        {mode === "uploaded_pdf" ? (
          <motion.div
            className="bg-secondary/35 rounded-lg border p-3"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <label className="text-sm font-medium" htmlFor="proposal-final-pdf">
              {copy.pdfLabel}
            </label>
            <input
              id="proposal-final-pdf"
              type="file"
              accept=".pdf,application/pdf"
              disabled={isSubmitting}
              className="file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0] ?? null;
                setFile(
                  selectedFile?.type === "application/pdf"
                    ? selectedFile
                    : null,
                );
              }}
            />
            <p className="text-muted-foreground mt-2 text-xs">{copy.pdfHelp}</p>
          </motion.div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || (mode === "uploaded_pdf" && !file)}
            onClick={() => void validateProposal()}
          >
            {submissionPhase === "uploading"
              ? copy.uploading
              : submissionPhase === "validating"
                ? copy.validating
                : copy.submit}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
