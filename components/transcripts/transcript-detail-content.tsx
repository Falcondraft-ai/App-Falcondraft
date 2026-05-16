"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Clock, ExternalLink, FileText, Pencil, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Transcript } from "@/types/transcript";

function formatDate(dateString: string, language: string) {
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

export function TranscriptDetailContent({
  transcript,
  userRole,
}: {
  transcript: Transcript;
  userRole: string;
}) {
  const router = useRouter();
  const { t, language } = useI18n();
  const [deleting, setDeleting] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(transcript.title);
  const [editContent, setEditContent] = React.useState(transcript.transcriptText ?? "");

  const isPending = transcript.status === "processing" || transcript.status === "waiting";

  React.useEffect(() => {
    if (!isPending) return;
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [isPending, router]);

  const canEdit = userRole !== "viewer" && !transcript.id.startsWith("deal-");
  const canDelete = userRole === "manager";

  const sourceLabel =
    transcript.source === "manual_paste"
      ? t("transcripts.source.paste")
      : transcript.source === "audio_upload"
        ? t("transcripts.source.audio")
        : t("transcripts.source.recording");

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
      router.replace("/dashboard/transcripts");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/transcripts/${transcript.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          title: editTitle,
          transcriptText: editContent,
        }),
      });
      if (!res.ok) {
        toast.error(t("transcripts.edit.error"));
        return;
      }
      toast.success(t("transcripts.edit.success"));
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditTitle(transcript.title);
    setEditContent(transcript.transcriptText ?? "");
    setEditing(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/transcripts">
            <ArrowLeft className="mr-2 size-3.5" />
            {t("transcripts.detail.back")}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {canEdit && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-2 size-3.5" />
              {t("transcripts.edit")}
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="mr-2 size-3.5" />
                  {t("transcripts.delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("transcripts.delete.title")}</AlertDialogTitle>
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
                    {deleting ? t("transcripts.delete.deleting") : t("transcripts.delete.confirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={<FileText className="size-4" />} label={t("transcripts.detail.source")} value={sourceLabel} />
        <InfoCard icon={<Clock className="size-4" />} label={t("transcripts.detail.createdAt")} value={formatDate(transcript.createdAt, language)} />
        {transcript.createdByName && (
          <InfoCard icon={<User className="size-4" />} label={t("transcripts.detail.createdBy")} value={transcript.createdByName} />
        )}
        {transcript.durationSeconds && (
          <InfoCard icon={<Clock className="size-4" />} label={t("transcripts.detail.duration")} value={`${Math.round(transcript.durationSeconds / 60)} min`} />
        )}
        {transcript.dealName && (
          <InfoCard icon={<FileText className="size-4" />} label={t("transcripts.detail.deal")} value={transcript.dealName} />
        )}
        {transcript.language && (
          <InfoCard icon={<FileText className="size-4" />} label={t("transcripts.detail.language")} value={transcript.language} />
        )}
      </div>

      {transcript.dealId && (
        <div className="bg-card flex items-center justify-between rounded-lg border px-5 py-3">
          <div className="flex items-center gap-2">
            <FileText className="text-muted-foreground size-4" />
            <span className="text-sm">
              {t("transcripts.detail.deal")} : <span className="font-medium">{transcript.dealName}</span>
            </span>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/deals/${transcript.dealId}`}>
              {t("transcripts.view")}
              <ExternalLink className="ml-1.5 size-3" />
            </Link>
          </Button>
        </div>
      )}

      <div className="bg-card rounded-lg border">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-sm font-medium">{t("transcripts.detail.content")}</h3>
          {editing && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>
                {t("transcripts.edit.cancel")}
              </Button>
              <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
                {saving ? t("transcripts.edit.saving") : t("transcripts.edit.save")}
              </Button>
            </div>
          )}
        </div>
        <div className="px-5 py-4">
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-muted-foreground text-xs font-medium">
                  {language === "en" ? "Title" : "Titre"}
                </label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-muted-foreground text-xs font-medium">
                  {t("transcripts.detail.content")}
                </label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={16}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {transcript.transcriptText ? (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {transcript.transcriptText}
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm italic">{t("transcripts.detail.noContent")}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {transcript.participants && (transcript.participants as unknown[]).length > 0 && (
        <div className="bg-card rounded-lg border">
          <div className="border-b px-5 py-3">
            <h3 className="text-sm font-medium">{t("transcripts.detail.participants")}</h3>
          </div>
          <div className="px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {(transcript.participants as Array<{ name?: string }>).map((p, i) => (
                <Badge key={i} variant="secondary">
                  {p.name ?? `Participant ${i + 1}`}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-muted-foreground text-xs">{label}</span>
      </div>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
