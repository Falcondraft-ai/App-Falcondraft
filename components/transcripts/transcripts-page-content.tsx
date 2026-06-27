"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Mic,
  Radio,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  Trash2,
  Archive,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/language-provider";
import { useBasePath } from "@/lib/navigation/base-path";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
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

type DealOption = { id: string; name: string; clientCompanyName: string };

const RECALL_STATUS_LABELS: Record<string, Record<Language, string>> = {
  joining_call: {
    fr: "Connexion à l'appel",
    en: "Joining call",
    es: "Conectando a la llamada",
  },
  in_waiting_room: {
    fr: "En salle d'attente",
    en: "In waiting room",
    es: "En sala de espera",
  },
  in_call_not_recording: {
    fr: "Dans l'appel",
    en: "In call",
    es: "En la llamada",
  },
  recording_permission_allowed: {
    fr: "Permission accordée",
    en: "Permission granted",
    es: "Permiso concedido",
  },
  recording_permission_denied: {
    fr: "Permission refusée",
    en: "Permission denied",
    es: "Permiso denegado",
  },
  in_call_recording: {
    fr: "Enregistrement en cours",
    en: "Recording",
    es: "Grabando",
  },
  call_ended: {
    fr: "Appel terminé",
    en: "Call ended",
    es: "Llamada finalizada",
  },
  done: { fr: "Terminé", en: "Done", es: "Terminado" },
  fatal: { fr: "Erreur fatale", en: "Fatal error", es: "Error crítico" },
};

function RecallBotStatusBadge({
  recallBotStatus,
  language,
}: {
  recallBotStatus: string;
  language: Language;
}) {
  const labels = RECALL_STATUS_LABELS[recallBotStatus];
  const label = labels ? getLocalizedCopy(language, labels) : recallBotStatus;

  if (
    recallBotStatus === "fatal" ||
    recallBotStatus === "recording_permission_denied"
  ) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
      >
        <AlertCircle className="size-3" />
        {label}
      </Badge>
    );
  }

  if (recallBotStatus === "in_call_recording") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
      >
        <span className="size-2 animate-pulse rounded-full bg-rose-500" />
        {label}
      </Badge>
    );
  }

  if (recallBotStatus === "done" || recallBotStatus === "call_ended") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
      >
        <Clock className="size-3" />
        {label}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
    >
      <Clock className="size-3" />
      {label}
    </Badge>
  );
}

function TranscriptStatusBadge({ transcript }: { transcript: Transcript }) {
  const { t, language } = useI18n();

  // For recall_ai source with a bot status, show the detailed Recall status
  if (
    transcript.source === "recall_ai" &&
    transcript.recallBotStatus &&
    transcript.status !== "ready" &&
    transcript.status !== "error"
  ) {
    return (
      <RecallBotStatusBadge
        recallBotStatus={transcript.recallBotStatus}
        language={language}
      />
    );
  }

  if (transcript.status === "ready") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      >
        <CheckCircle2 className="size-3" />
        {t("transcripts.status.ready")}
      </Badge>
    );
  }
  if (transcript.status === "waiting") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
      >
        <Clock className="size-3" />
        {t("transcripts.status.waiting")}
      </Badge>
    );
  }
  if (transcript.status === "processing") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
      >
        <Clock className="size-3" />
        {t("transcripts.status.processing")}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
    >
      <AlertCircle className="size-3" />
      {t("transcripts.status.error")}
    </Badge>
  );
}

function TranscriptSourceLabel({ source }: { source: Transcript["source"] }) {
  const { t } = useI18n();
  if (source === "manual_paste")
    return (
      <span className="text-muted-foreground text-xs">
        {t("transcripts.source.paste")}
      </span>
    );
  if (source === "audio_upload")
    return (
      <span className="text-muted-foreground text-xs">
        {t("transcripts.source.audio")}
      </span>
    );
  return (
    <span className="text-muted-foreground text-xs">
      {t("transcripts.source.recording")}
    </span>
  );
}

function formatRelativeDate(dateString: string, language: Language) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(languageIntlLocales[language], {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function TranscriptRowActions({
  transcript,
  canDelete,
  onRefresh,
}: {
  transcript: Transcript;
  canDelete: boolean;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const router = useRouter();
  const basePath = useBasePath();

  const isDealBased = transcript.id.startsWith("deal-");
  const href = `${basePath}/transcripts/${transcript.id}`;

  async function handleArchive() {
    if (isDealBased) {
      const dealId = transcript.id.replace("deal-", "");
      const res = await fetch(`/api/transcripts/deal-transcript`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, action: "archive" }),
      });
      if (!res.ok) {
        toast.error(t("transcripts.archive.error"));
        return;
      }
    } else {
      const res = await fetch(`/api/transcripts/${transcript.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (!res.ok) {
        toast.error(t("transcripts.archive.error"));
        return;
      }
    }
    toast.success(t("transcripts.archive.success"));
    onRefresh();
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      if (isDealBased) {
        const dealId = transcript.id.replace("deal-", "");
        const res = await fetch(`/api/transcripts/deal-transcript`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealId }),
        });
        if (!res.ok) {
          toast.error(t("transcripts.delete.error"));
          return;
        }
      } else {
        const res = await fetch(`/api/transcripts/${transcript.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          toast.error(t("transcripts.delete.error"));
          return;
        }
      }
      toast.success(t("transcripts.delete.success"));
      onRefresh();
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  return (
    <>
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
          <DropdownMenuItem onClick={() => router.push(href)}>
            <Eye className="mr-2 size-3.5" />
            {t("transcripts.view")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleArchive()}>
            <Archive className="mr-2 size-3.5" />
            {t("transcripts.archive")}
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
              {deleting
                ? t("transcripts.delete.deleting")
                : t("transcripts.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TranscriptRow({
  transcript,
  canDelete,
  onRefresh,
}: {
  transcript: Transcript;
  canDelete: boolean;
  onRefresh: () => void;
}) {
  const { t, language } = useI18n();
  const basePath = useBasePath();

  const href = `${basePath}/transcripts/${transcript.id}`;

  return (
    <div className="group flex items-start justify-between gap-4 border-b px-1 py-3.5 last:border-b-0">
      <Link href={href} className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium group-hover:underline">
            {transcript.title}
          </p>
          <TranscriptStatusBadge transcript={transcript} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <TranscriptSourceLabel source={transcript.source} />
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
          {transcript.source === "recall_ai" &&
            transcript.status !== "ready" && (
              <span className="text-muted-foreground text-xs italic">
                {t(`transcripts.status.${transcript.status}.hint` as never)}
              </span>
            )}
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-muted-foreground text-xs">
          {formatRelativeDate(transcript.createdAt, language)}
        </span>
        <TranscriptRowActions
          transcript={transcript}
          canDelete={canDelete}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  );
}

function SourceCards() {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SourceCard
        icon={<FileText className="size-5 text-emerald-600" />}
        title={t("transcripts.source.paste")}
        description={t("transcripts.source.paste.description")}
        available
      />
      <SourceCard
        icon={<Mic className="size-5 text-amber-600" />}
        title={t("transcripts.source.audio")}
        description={t("transcripts.source.audio.description")}
        available
      />
      <SourceCard
        icon={<Radio className="size-5 text-blue-600" />}
        title={t("transcripts.source.recording")}
        description={t("transcripts.source.recording.description")}
        available
      />
    </div>
  );
}

export function TranscriptsPageContent({
  transcripts,
  userRole,
}: {
  transcripts: Transcript[];
  deals?: DealOption[];
  userRole: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const basePath = useBasePath();
  const canCreate = userRole !== "viewer";
  const canDelete = userRole === "manager";

  const hasPending = transcripts.some(
    (t) => t.status === "processing" || t.status === "waiting",
  );

  React.useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [hasPending, router]);

  if (transcripts.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          title={t("transcripts.empty.title")}
          description={t("transcripts.empty.description")}
          action={
            canCreate ? (
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href={`${basePath}/transcripts/recall`}>
                    <Radio className="mr-2 size-4" />
                    {t("transcripts.recall.button")}
                  </Link>
                </Button>
                <Button asChild>
                  <Link href={`${basePath}/transcripts/new`}>
                    <Plus className="mr-2 size-4" />
                    {t("transcripts.new")}
                  </Link>
                </Button>
              </div>
            ) : undefined
          }
        />
        <SourceCards />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {transcripts.length} {t("transcripts.count")}
          {transcripts.length > 1 ? "s" : ""}
        </p>
        {canCreate && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`${basePath}/transcripts/recall`}>
                <Radio className="mr-2 size-4" />
                {t("transcripts.recall.button")}
              </Link>
            </Button>
            <Button asChild>
              <Link href={`${basePath}/transcripts/new`}>
                <Plus className="mr-2 size-4" />
                {t("transcripts.new")}
              </Link>
            </Button>
          </div>
        )}
      </div>
      <div className="bg-card rounded-lg border">
        <div className="divide-y px-4">
          {transcripts.map((item) => (
            <TranscriptRow
              key={item.id}
              transcript={item}
              canDelete={canDelete}
              onRefresh={() => router.refresh()}
            />
          ))}
        </div>
      </div>
      <SourceCards />
    </div>
  );
}

function SourceCard({
  icon,
  title,
  description,
  available,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  available: boolean;
  badge?: string;
}) {
  return (
    <div className="bg-card relative rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 pt-0.5">{icon}</div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      {!available && badge && (
        <Badge
          variant="secondary"
          className="absolute top-3 right-3 text-[10px]"
        >
          {badge}
        </Badge>
      )}
    </div>
  );
}
