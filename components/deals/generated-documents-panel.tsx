"use client";

import { Download, ExternalLink } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { GeneratedDealDocument } from "@/types/document";

function getErrorMessage(result: unknown, fallback: string) {
  if (
    result &&
    typeof result === "object" &&
    "message" in result &&
    typeof result.message === "string"
  ) {
    return result.message;
  }

  return fallback;
}

async function resolveDocumentUrl(
  document: GeneratedDealDocument,
  download: boolean,
) {
  if (document.url) {
    return document.url;
  }

  if (!document.hasStoragePath) {
    throw new Error("Aucun fichier disponible pour ce document.");
  }

  const response = await fetch(
    `/api/documents/${document.id}/signed-url${download ? "?download=1" : ""}`,
  ).catch(() => null);

  if (!response?.ok) {
    const result: unknown = await response?.json().catch(() => null);
    throw new Error(
      getErrorMessage(result, "Le lien sécurisé n’a pas pu être généré."),
    );
  }

  const result: unknown = await response.json().catch(() => null);

  if (
    !result ||
    typeof result !== "object" ||
    !("url" in result) ||
    typeof result.url !== "string"
  ) {
    throw new Error("Le lien sécurisé est invalide.");
  }

  return result.url;
}

export function GeneratedDocumentButtons({
  document,
  compact = false,
  fullWidth = false,
  showOpen = true,
  showDownload = true,
  downloadLabel,
}: {
  document?: GeneratedDealDocument;
  compact?: boolean;
  fullWidth?: boolean;
  showOpen?: boolean;
  showDownload?: boolean;
  downloadLabel?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [loadingAction, setLoadingAction] = React.useState<
    "open" | "download" | null
  >(null);

  async function openDocument(download: boolean) {
    if (!document) {
      toast.error("Document indisponible", {
        description: "Le fichier n’est pas encore disponible pour ce dossier.",
      });
      return;
    }

    setLoadingAction(download ? "download" : "open");

    try {
      const url = await resolveDocumentUrl(document, download);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(
        download ? "Téléchargement impossible" : "Ouverture impossible",
        {
          description:
            error instanceof Error
              ? error.message
              : "Le document n’a pas pu être ouvert.",
        },
      );
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className={cn(fullWidth ? "grid gap-2" : "flex flex-wrap gap-2")}>
      {showOpen ? (
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          className={cn(
            fullWidth &&
              "bg-card/75 hover:bg-secondary/60 w-full justify-between rounded-md px-3 shadow-none",
          )}
          disabled={!document || loadingAction !== null}
          onClick={() => void openDocument(false)}
        >
          <ExternalLink aria-hidden="true" />
          {loadingAction === "open" ? "Ouverture..." : t("common.actions.open")}
        </Button>
      ) : null}
      {showDownload ? (
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          className={cn(
            fullWidth &&
              "bg-card/75 hover:bg-secondary/60 w-full justify-between rounded-md px-3 shadow-none",
          )}
          disabled={!document || loadingAction !== null}
          onClick={() => void openDocument(true)}
        >
          <Download aria-hidden="true" />
          {loadingAction === "download"
            ? "Préparation..."
            : (downloadLabel ?? t("common.actions.download"))}
        </Button>
      ) : null}
    </div>
  );
}

function isOpenOnlyDocument(document: GeneratedDealDocument): boolean {
  return ["proposal_gamma", "proposal_pdf"].includes(document.type);
}

export function GeneratedDocumentsPanel({
  documents,
}: {
  documents: GeneratedDealDocument[];
}) {
  const { t } = useI18n();

  if (documents.length === 0) {
    return (
      <p className="text-muted-foreground text-sm leading-6">
        {t("common.empty.documents.description")}
      </p>
    );
  }

  return (
    <div className="bg-card/70 divide-y rounded-md border">
      {documents.map((document) => (
        <div
          key={document.id}
          className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-medium">
              {t(`documentType.${document.type}` as TranslationKey)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t(`common.status.${document.status}` as TranslationKey)} ·{" "}
              {document.title}
            </p>
          </div>
          <GeneratedDocumentButtons
            document={document}
            compact
            showOpen={
              isOpenOnlyDocument(document) ||
              (document.type !== "quote_pdf" &&
                document.type !== "final_document_pdf")
            }
            showDownload={!isOpenOnlyDocument(document)}
            downloadLabel={
              document.type === "quote_pdf"
                ? t("common.actions.downloadQuote")
                : document.type === "final_document_pdf"
                  ? t("common.actions.downloadFinalDocument")
                  : t("common.actions.download")
            }
          />
        </div>
      ))}
    </div>
  );
}
