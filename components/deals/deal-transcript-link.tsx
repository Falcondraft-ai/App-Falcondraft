"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Link2, Unlink, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/language-provider";
import { useBasePath } from "@/lib/navigation/base-path";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLocalizedCopy } from "@/lib/i18n/translations";

type LinkedTranscript = { id: string; title: string } | null;
type AvailableTranscript = { id: string; title: string; createdAt: string };

export function DealTranscriptLink({
  dealId,
  linkedTranscript,
  availableTranscripts,
  canEdit,
}: {
  dealId: string;
  linkedTranscript: LinkedTranscript;
  availableTranscripts: AvailableTranscript[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { language } = useI18n();
  const basePath = useBasePath();
  const [linking, setLinking] = React.useState(false);
  const [unlinking, setUnlinking] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string>("");

  async function handleLink() {
    if (!selectedId) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/transcript-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptId: selectedId }),
      });
      if (!res.ok) {
        toast.error(
          getLocalizedCopy(language, {
            fr: "Liaison impossible.",
            en: "Failed to link transcript.",
            es: "No se ha podido asociar la transcripción.",
          }),
        );
        return;
      }
      toast.success(
        getLocalizedCopy(language, {
          fr: "Transcript associé.",
          en: "Transcript linked.",
          es: "Transcripción asociada.",
        }),
      );
      setSelectedId("");
      router.refresh();
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    setUnlinking(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/transcript-link`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(
          getLocalizedCopy(language, {
            fr: "Dissociation impossible.",
            en: "Failed to unlink transcript.",
            es: "No se ha podido desvincular la transcripción.",
          }),
        );
        return;
      }
      toast.success(
        getLocalizedCopy(language, {
          fr: "Transcript dissocié.",
          en: "Transcript unlinked.",
          es: "Transcripción desvinculada.",
        }),
      );
      router.refresh();
    } finally {
      setUnlinking(false);
    }
  }

  if (linkedTranscript) {
    return (
      <div className="bg-card flex items-center justify-between gap-3 rounded-md border p-3">
        <div className="flex min-w-0 items-center gap-2">
          <MessageSquareText className="text-muted-foreground size-4 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {linkedTranscript.title}
            </p>
            <p className="text-muted-foreground text-xs">
              {getLocalizedCopy(language, {
                fr: "Transcript associé",
                en: "Linked transcript",
                es: "Transcripción asociada",
              })}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`${basePath}/transcripts/${linkedTranscript.id}`}>
              <ExternalLink className="mr-1.5 size-3" />
              {getLocalizedCopy(language, {
                fr: "Ouvrir",
                en: "Open",
                es: "Abrir",
              })}
            </Link>
          </Button>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleUnlink()}
              disabled={unlinking}
              className="text-destructive hover:bg-destructive/10"
            >
              <Unlink className="mr-1.5 size-3" />
              {unlinking
                ? getLocalizedCopy(language, {
                    fr: "Dissociation...",
                    en: "Unlinking...",
                    es: "Desvinculando...",
                  })
                : getLocalizedCopy(language, {
                    fr: "Dissocier",
                    en: "Unlink",
                    es: "Desvincular",
                  })}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!canEdit) return null;

  if (availableTranscripts.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3">
        <p className="text-muted-foreground text-sm">
          {getLocalizedCopy(language, {
            fr: "Aucun transcript disponible pour l'association.",
            en: "No transcript available to link.",
            es: "No hay ninguna transcripción disponible para asociar.",
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link2 className="text-muted-foreground size-4 shrink-0" />
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="h-8 flex-1">
            <SelectValue
              placeholder={getLocalizedCopy(language, {
                fr: "Sélectionner un transcript...",
                en: "Select a transcript...",
                es: "Seleccionar una transcripción...",
              })}
            />
          </SelectTrigger>
          <SelectContent>
            {availableTranscripts.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        size="sm"
        onClick={() => void handleLink()}
        disabled={!selectedId || linking}
      >
        <Link2 className="mr-1.5 size-3" />
        {linking
          ? getLocalizedCopy(language, {
              fr: "Association...",
              en: "Linking...",
              es: "Asociando...",
            })
          : getLocalizedCopy(language, {
              fr: "Associer",
              en: "Link",
              es: "Asociar",
            })}
      </Button>
    </div>
  );
}
