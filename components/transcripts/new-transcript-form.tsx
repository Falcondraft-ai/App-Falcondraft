"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileAudio,
  FileText,
  MessageSquareText,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLocalizedCopy } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

type DealOption = { id: string; name: string; clientCompanyName: string };
type SourceMode = "paste" | "audio";

const ACCEPTED_AUDIO_FORMATS = ".mp3,.wav,.m4a,.webm";
const MAX_FILE_SIZE_MB = 100;

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function NewTranscriptForm({ deals }: { deals: DealOption[] }) {
  const router = useRouter();
  const { t, language } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [direction, setDirection] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [sourceMode, setSourceMode] = React.useState<SourceMode>("paste");
  const [transcriptText, setTranscriptText] = React.useState("");
  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const [dealId, setDealId] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const steps = [
    {
      eyebrow: "01",
      title: t("transcripts.form.step1.title"),
      description: t("transcripts.form.step1.description"),
    },
    {
      eyebrow: "02",
      title: t("transcripts.form.step2.title"),
      description: t("transcripts.form.step2.description"),
    },
    {
      eyebrow: "03",
      title: t("transcripts.form.step3.title"),
      description: t("transcripts.form.step3.description"),
    },
  ];

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const progress = ((stepIndex + 1) / steps.length) * 100;

  function canAdvance() {
    if (stepIndex === 0) return title.trim().length >= 3;
    if (stepIndex === 1) {
      if (sourceMode === "paste") return transcriptText.trim().length >= 20;
      return audioFile !== null;
    }
    return true;
  }

  function goNext() {
    if (!canAdvance()) return;
    setDirection(1);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function goPrevious() {
    setDirection(-1);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(
        getLocalizedCopy(language, {
          fr: `Le fichier dépasse la limite de ${MAX_FILE_SIZE_MB} Mo.`,
          en: `File exceeds ${MAX_FILE_SIZE_MB} MB limit.`,
          es: `El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB.`,
        }),
      );
      return;
    }

    setAudioFile(file);
  }

  function removeFile() {
    setAudioFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    setIsSubmitting(true);

    try {
      if (sourceMode === "paste") {
        if (!title.trim() || !transcriptText.trim()) return;

        const res = await fetch("/api/transcripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            transcriptText: transcriptText.trim(),
            dealId: dealId && dealId !== "none" ? dealId : null,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error ?? t("transcripts.delete.error"));
          return;
        }
      } else {
        if (!title.trim() || !audioFile) return;

        const formData = new FormData();
        formData.append("file", audioFile);
        formData.append("title", title.trim());
        if (dealId && dealId !== "none") formData.append("dealId", dealId);

        const res = await fetch("/api/transcripts/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error ?? t("transcripts.delete.error"));
          return;
        }
      }

      toast.success(t("transcripts.form.success"), {
        description: title.trim(),
      });
      router.replace("/dashboard/transcripts");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  const copy = {
    sourceLabel: getLocalizedCopy(language, {
      fr: "Source du contenu",
      en: "Content source",
      es: "Fuente del contenido",
    }),
    pasteOption: getLocalizedCopy(language, {
      fr: "Coller le texte",
      en: "Paste text",
      es: "Pegar texto",
    }),
    audioOption: getLocalizedCopy(language, {
      fr: "Téléverser un audio",
      en: "Upload audio",
      es: "Subir audio",
    }),
    audioDropzone: getLocalizedCopy(language, {
      fr: "Cliquez ou déposez un fichier audio ici",
      en: "Click or drag an audio file here",
      es: "Haz clic o arrastra un archivo de audio aquí",
    }),
    audioFormats: getLocalizedCopy(language, {
      fr: "Formats acceptés : MP3, WAV, M4A, WebM — max 100 Mo",
      en: "Accepted: MP3, WAV, M4A, WebM — max 100 MB",
      es: "Formatos aceptados: MP3, WAV, M4A, WebM — máx. 100 MB",
    }),
    audioSelected: getLocalizedCopy(language, {
      fr: "Fichier sélectionné",
      en: "Selected file",
      es: "Archivo seleccionado",
    }),
    audioProcessingNote: getLocalizedCopy(language, {
      fr: "Le transcript sera marqué « En traitement » jusqu'à la transcription.",
      en: 'The transcript will be marked as "Processing" until transcription is complete.',
      es: 'La transcripción se marcará como "En curso" hasta que finalice.',
    }),
  };

  return (
    <section className="dark:bg-card/90 border bg-[#f1eadf] shadow-[0_24px_70px_-48px_rgba(22,31,48,0.62)]">
      <div className="grid lg:min-h-[30rem] lg:grid-cols-[19rem_1fr]">
        <aside className="border-b border-[#26344d] bg-[#142033] px-5 py-5 text-[#f7f1e8] lg:border-r lg:border-b-0">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border border-white/15 bg-white/10">
              <MessageSquareText className="size-4" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-xs font-medium tracking-[0.16em] uppercase opacity-65">
                {t("transcripts.form.guided")}
              </p>
              <h2 className="mt-1 text-base font-semibold tracking-tight">
                {t("transcripts.form.title")}
              </h2>
            </div>
          </div>

          <div className="mt-6 h-1 bg-white/10">
            <motion.div
              className="h-full bg-[#c69a61]"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
            />
          </div>

          <ol className="mt-7 space-y-2">
            {steps.map((step, index) => {
              const isActive = index === stepIndex;
              const isDone = index < stepIndex;

              return (
                <li key={step.eyebrow}>
                  <button
                    type="button"
                    disabled={index > stepIndex}
                    onClick={() => {
                      setDirection(index > stepIndex ? 1 : -1);
                      setStepIndex(index);
                    }}
                    className={cn(
                      "w-full rounded-md border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                      isActive
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-transparent text-white/62 hover:bg-white/5",
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span>
                        <span className="block text-[11px] font-medium tracking-[0.14em] uppercase opacity-60">
                          {step.eyebrow}
                        </span>
                        <span className="mt-1 block text-sm font-medium">
                          {step.title}
                        </span>
                      </span>
                      {isDone ? (
                        <span className="flex size-5 items-center justify-center rounded-md border border-white/20 bg-white/10">
                          <Check className="size-3" strokeWidth={1.8} />
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {title.trim() && (
            <div className="mt-8 border-t border-white/10 pt-5 text-sm text-white/68">
              <p className="font-medium text-white/85">{title.trim()}</p>
              {sourceMode === "audio" && audioFile && (
                <p className="mt-1 text-xs opacity-65">
                  <FileAudio className="mr-1 inline size-3" />
                  {audioFile.name}
                </p>
              )}
            </div>
          )}
        </aside>

        <div className="bg-card/92 flex min-h-[26rem] flex-col">
          <div className="border-b px-5 py-5 sm:px-6">
            <p className="text-muted-foreground text-xs font-medium tracking-[0.12em] uppercase">
              {t("transcripts.form.step")
                .replace("{current}", String(stepIndex + 1))
                .replace("{total}", String(steps.length))}
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
              {currentStep.title}
            </h3>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
              {currentStep.description}
            </p>
          </div>

          <div className="flex-1 px-5 py-5 sm:px-6">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={stepIndex}
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction * 20 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction * -20 }
                }
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="min-h-[16rem]"
              >
                {stepIndex === 0 && (
                  <div className="max-w-lg space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="transcript-title">
                        {t("transcripts.form.step1.label")}
                      </Label>
                      <Input
                        id="transcript-title"
                        placeholder={t("transcripts.form.step1.placeholder")}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        autoFocus
                      />
                      <p className="text-muted-foreground text-xs">
                        {t("transcripts.form.step1.help")}
                      </p>
                    </div>
                  </div>
                )}

                {stepIndex === 1 && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSourceMode("paste")}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                          sourceMode === "paste"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted/50",
                        )}
                      >
                        <FileText className="size-4" />
                        {copy.pasteOption}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceMode("audio")}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                          sourceMode === "audio"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted/50",
                        )}
                      >
                        <FileAudio className="size-4" />
                        {copy.audioOption}
                      </button>
                    </div>

                    {sourceMode === "paste" ? (
                      <div className="space-y-2">
                        <Label htmlFor="transcript-text">
                          {t("transcripts.form.step2.label")}
                        </Label>
                        <Textarea
                          id="transcript-text"
                          placeholder={t("transcripts.form.step2.placeholder")}
                          rows={12}
                          value={transcriptText}
                          onChange={(e) => setTranscriptText(e.target.value)}
                          autoFocus
                        />
                        <p className="text-muted-foreground text-xs">
                          {t("transcripts.form.step2.help")}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {!audioFile ? (
                          <label
                            htmlFor="audio-file-input"
                            className="hover:border-primary/50 hover:bg-muted/30 flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 transition-colors"
                          >
                            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                              <Upload className="text-muted-foreground size-5" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium">
                                {copy.audioDropzone}
                              </p>
                              <p className="text-muted-foreground mt-1 text-xs">
                                {copy.audioFormats}
                              </p>
                            </div>
                            <input
                              ref={fileInputRef}
                              id="audio-file-input"
                              type="file"
                              accept={ACCEPTED_AUDIO_FORMATS}
                              className="sr-only"
                              onChange={handleFileChange}
                            />
                          </label>
                        ) : (
                          <div className="bg-card max-w-md rounded-lg border p-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md">
                                <FileAudio className="text-muted-foreground size-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {audioFile.name}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  {formatFileSize(audioFile.size)}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={removeFile}
                                className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                        <p className="text-muted-foreground text-xs">
                          {copy.audioProcessingNote}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {stepIndex === 2 && (
                  <div className="max-w-lg space-y-4">
                    {deals.length > 0 ? (
                      <div className="space-y-2">
                        <Label htmlFor="transcript-deal">
                          {t("transcripts.form.step3.dealLabel")}
                        </Label>
                        <Select value={dealId} onValueChange={setDealId}>
                          <SelectTrigger id="transcript-deal">
                            <SelectValue
                              placeholder={t("transcripts.form.step3.noDeal")}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              {t("transcripts.form.step3.noDeal")}
                            </SelectItem>
                            {deals.map((deal) => (
                              <SelectItem key={deal.id} value={deal.id}>
                                {deal.name} — {deal.clientCompanyName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-muted-foreground text-xs">
                          {t("transcripts.form.step3.dealHelp")}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-4">
                        <div className="flex items-start gap-3">
                          <FileText className="text-muted-foreground mt-0.5 size-5" />
                          <div>
                            <p className="text-sm font-medium">
                              {t("transcripts.form.step3.noDealsTitle")}
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {t("transcripts.form.step3.noDealsDescription")}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-muted/30 rounded-lg border p-4">
                      <p className="text-sm font-medium">
                        {t("transcripts.form.step3.summary")}
                      </p>
                      <dl className="mt-2 space-y-1 text-xs">
                        <div className="flex gap-2">
                          <dt className="text-muted-foreground">
                            {t("transcripts.form.step3.summaryTitle")}
                          </dt>
                          <dd className="font-medium">{title.trim()}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-muted-foreground">Source :</dt>
                          <dd className="font-medium">
                            {sourceMode === "paste"
                              ? t("transcripts.source.paste")
                              : t("transcripts.source.audio")}
                          </dd>
                        </div>
                        {sourceMode === "paste" && (
                          <div className="flex gap-2">
                            <dt className="text-muted-foreground">
                              {t("transcripts.form.step3.summaryLength")}
                            </dt>
                            <dd className="font-medium">
                              {transcriptText.trim().length} car.
                            </dd>
                          </div>
                        )}
                        {sourceMode === "audio" && audioFile && (
                          <div className="flex gap-2">
                            <dt className="text-muted-foreground">
                              {getLocalizedCopy(language, {
                                fr: "Fichier :",
                                en: "File:",
                                es: "Archivo:",
                              })}
                            </dt>
                            <dd className="truncate font-medium">
                              {audioFile.name} ({formatFileSize(audioFile.size)}
                              )
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="bg-muted/35 flex flex-col-reverse gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Button
              type="button"
              variant="outline"
              disabled={stepIndex === 0 || isSubmitting}
              onClick={goPrevious}
            >
              <ArrowLeft aria-hidden="true" />
              {t("transcripts.form.previous")}
            </Button>
            <div className="flex items-center justify-end gap-2">
              <span className="text-muted-foreground hidden text-sm sm:inline">
                {t("transcripts.form.completed").replace(
                  "{percent}",
                  String(Math.round(progress)),
                )}
              </span>
              {isLastStep ? (
                <Button
                  type="button"
                  disabled={isSubmitting || !canAdvance()}
                  onClick={() => void handleSubmit()}
                >
                  {isSubmitting
                    ? t("transcripts.form.creating")
                    : t("transcripts.form.create")}
                </Button>
              ) : (
                <Button type="button" disabled={!canAdvance()} onClick={goNext}>
                  {t("transcripts.form.next")}
                  <ArrowRight aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
