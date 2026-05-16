"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Link2, Unlink, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
        toast.error(language === "en" ? "Failed to link transcript." : "Liaison impossible.");
        return;
      }
      toast.success(language === "en" ? "Transcript linked." : "Transcript associé.");
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
        toast.error(language === "en" ? "Failed to unlink transcript." : "Dissociation impossible.");
        return;
      }
      toast.success(language === "en" ? "Transcript unlinked." : "Transcript dissocié.");
      router.refresh();
    } finally {
      setUnlinking(false);
    }
  }

  if (linkedTranscript) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-card p-3">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquareText className="text-muted-foreground size-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{linkedTranscript.title}</p>
            <p className="text-muted-foreground text-xs">
              {language === "en" ? "Linked transcript" : "Transcript associé"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/transcripts/${linkedTranscript.id}`}>
              <ExternalLink className="mr-1.5 size-3" />
              {language === "en" ? "Open" : "Ouvrir"}
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
                ? (language === "en" ? "Unlinking..." : "Dissociation...")
                : (language === "en" ? "Unlink" : "Dissocier")}
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
          {language === "en"
            ? "No transcript available to link."
            : "Aucun transcript disponible pour l'association."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed p-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Link2 className="text-muted-foreground size-4 shrink-0" />
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="h-8 flex-1">
            <SelectValue
              placeholder={language === "en" ? "Select a transcript..." : "Sélectionner un transcript..."}
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
          ? (language === "en" ? "Linking..." : "Association...")
          : (language === "en" ? "Link" : "Associer")}
      </Button>
    </div>
  );
}
