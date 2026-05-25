"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const TRANSCRIPT_PREVIEW_LENGTH = 720;
const CONTEXT_PREVIEW_LENGTH = 260;

function createPreview(value: string, maxLength: number) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();

  if (normalizedValue.length <= maxLength) {
    return {
      text: normalizedValue,
      isTruncated: false,
    };
  }

  const cutIndex = normalizedValue.lastIndexOf(" ", maxLength);
  const safeCutIndex = cutIndex > maxLength * 0.72 ? cutIndex : maxLength;

  return {
    text: `${normalizedValue.slice(0, safeCutIndex).trimEnd()}…`,
    isTruncated: true,
  };
}

function FullTextBlock({ title, value }: { title: string; value: string }) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 border bg-muted/30 p-4">
        <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
          {value}
        </p>
      </div>
    </section>
  );
}

export function TranscriptPanel({
  transcript,
  additionalContext,
}: {
  transcript: string;
  additionalContext: string;
}) {
  const transcriptPreview = createPreview(
    transcript,
    TRANSCRIPT_PREVIEW_LENGTH,
  );
  const contextPreview = createPreview(
    additionalContext,
    CONTEXT_PREVIEW_LENGTH,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">
            Transcript d’appel
          </p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Extrait conservé comme base de travail du dossier.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--background-subtle)]"
            >
              <ExternalLink aria-hidden="true" />
              Ouvrir
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Transcript complet</DialogTitle>
              <DialogDescription>
                Notes d’appel et contexte complémentaire associés au dossier.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <FullTextBlock title="Transcript d’appel" value={transcript} />
              <FullTextBlock
                title="Informations complémentaires"
                value={additionalContext}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div
        className="rounded-md border bg-[var(--background-subtle)] p-3"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="text-sm leading-7 text-[var(--muted-foreground)]">
          {transcriptPreview.text}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--muted-foreground)]">
          Informations complémentaires
        </p>
        <div
          className="mt-2 rounded-md border bg-[var(--background-subtle)] p-3"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-sm leading-6 text-[var(--muted-foreground)]">
            {contextPreview.text}
          </p>
        </div>
      </div>

      {transcriptPreview.isTruncated || contextPreview.isTruncated ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          Version complète disponible dans la vue détaillée.
        </p>
      ) : null}
    </div>
  );
}
