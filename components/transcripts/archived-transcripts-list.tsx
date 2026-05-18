"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArchiveRestore,
  MessageSquareText,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  getLocalizedCopy,
  languageIntlLocales,
  type Language,
} from "@/lib/i18n/translations";
import type { Transcript } from "@/types/transcript";

function formatDate(dateString: string, language: Language) {
  return new Intl.DateTimeFormat(languageIntlLocales[language], {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateString));
}

function ArchivedTranscriptRow({
  transcript,
  canDelete,
  onRefresh,
}: {
  transcript: Transcript;
  canDelete: boolean;
  onRefresh: () => void;
}) {
  const { t, language } = useI18n();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function handleUnarchive() {
    const res = await fetch(`/api/transcripts/${transcript.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unarchive" }),
    });
    if (!res.ok) {
      toast.error(t("transcripts.archive.error"));
      return;
    }
    toast.success(t("transcripts.unarchive.success"));
    onRefresh();
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/transcripts/${transcript.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t("transcripts.delete.error"));
        return;
      }
      toast.success(t("transcripts.delete.success"));
      onRefresh();
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b px-1 py-3 last:border-b-0">
      <Link
        href={`/dashboard/transcripts/${transcript.id}`}
        className="min-w-0 flex-1"
      >
        <p className="truncate text-sm font-medium hover:underline">
          {transcript.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          {transcript.dealName && (
            <span className="text-muted-foreground text-xs">
              {t("transcripts.deal")} : {transcript.dealName}
            </span>
          )}
          {transcript.createdByName && (
            <span className="text-muted-foreground text-xs">
              {t("transcripts.by")} {transcript.createdByName}
            </span>
          )}
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-muted-foreground text-xs">
          {formatDate(transcript.createdAt, language)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
              aria-label="Actions"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => void handleUnarchive()}>
              <ArchiveRestore className="mr-2 size-3.5" />
              {t("transcripts.unarchive")}
            </DropdownMenuItem>
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 size-3.5" />
                  {t("transcripts.delete")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("transcripts.delete.title")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("transcripts.delete.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("transcripts.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting
                  ? t("transcripts.delete.deleting")
                  : t("transcripts.delete.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export function ArchivedTranscriptsList({
  transcripts,
  userRole,
}: {
  transcripts: Transcript[];
  userRole: string;
}) {
  const router = useRouter();
  const { t, language } = useI18n();
  const canDelete = userRole === "manager";

  if (transcripts.length === 0) {
    return (
      <section className="bg-card/75 rounded-lg border p-4">
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <MessageSquareText className="text-muted-foreground size-8 opacity-40" />
          <p className="text-muted-foreground text-sm">
            {getLocalizedCopy(language, {
              fr: "Aucun transcript archivé.",
              en: "No archived transcripts.",
              es: "No hay transcripciones archivadas.",
            })}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-card/75 rounded-lg border">
      <div className="divide-y px-4">
        {transcripts.map((item) => (
          <ArchivedTranscriptRow
            key={item.id}
            transcript={item}
            canDelete={canDelete}
            onRefresh={() => router.refresh()}
          />
        ))}
      </div>
    </section>
  );
}
