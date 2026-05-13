"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  const shouldReduceMotion = useReducedMotion();
  const [mode, setMode] =
    React.useState<ProposalValidationSource>("initial_export");
  const [file, setFile] = React.useState<File | null>(null);
  const [submissionPhase, setSubmissionPhase] =
    React.useState<SubmissionPhase>("idle");
  const isSubmitting = submissionPhase !== "idle";

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
          : "La validation n’a pas pu être déclenchée.";

      toast.error("Validation impossible", {
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
          : "Le PDF n’a pas pu être importé.";

      toast.error("Upload impossible", {
        description: message,
      });
      return false;
    }

    return true;
  }

  async function validateProposal() {
    if (mode === "uploaded_pdf" && !file) {
      toast.error("PDF requis", {
        description: "Ajoutez le PDF de la dernière version avant de valider.",
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

    toast.success("Proposition validée", {
      description: "La préparation du document final est lancée.",
    });
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Valider la proposition</DialogTitle>
          <DialogDescription>
            Choisissez la version qui doit être transmise pour validation finale.
          </DialogDescription>
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
                      {option.title}
                    </span>
                    <span className="text-muted-foreground mt-1 block text-sm leading-5">
                      {option.description}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </motion.div>

        {mode === "uploaded_pdf" ? (
          <motion.div
            className="rounded-lg border bg-secondary/35 p-3"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <label className="text-sm font-medium" htmlFor="proposal-final-pdf">
              PDF de la dernière version
            </label>
            <input
              id="proposal-final-pdf"
              type="file"
              accept=".pdf,application/pdf"
              disabled={isSubmitting}
              className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0] ?? null;
                setFile(
                  selectedFile?.type === "application/pdf"
                    ? selectedFile
                    : null,
                );
              }}
            />
            <p className="text-muted-foreground mt-2 text-xs">
              Le fichier reste modifiable avant validation. Format PDF uniquement.
            </p>
          </motion.div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || (mode === "uploaded_pdf" && !file)}
            onClick={() => void validateProposal()}
          >
            {submissionPhase === "uploading"
              ? "Upload en cours…"
              : submissionPhase === "validating"
                ? "Validation en cours…"
                : "Valider cette version"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
