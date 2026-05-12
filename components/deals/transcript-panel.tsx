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
    <div className="rounded-md border bg-card p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium">Transcript d’appel</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Extrait conservé comme base de travail du dossier.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
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
                title="Contexte complémentaire"
                value={additionalContext}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-muted-foreground mt-4 text-sm leading-7">
        {transcriptPreview.text}
      </p>

      <div className="mt-4 border-t pt-3">
        <p className="text-muted-foreground text-xs font-medium">
          Contexte complémentaire
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          {contextPreview.text}
        </p>
      </div>

      {transcriptPreview.isTruncated || contextPreview.isTruncated ? (
        <p className="text-muted-foreground mt-3 text-xs">
          Version complète disponible dans la vue détaillée.
        </p>
      ) : null}
    </div>
  );
}
