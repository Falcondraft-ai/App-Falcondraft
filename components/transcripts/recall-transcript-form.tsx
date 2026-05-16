"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Radio, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DealOption = { id: string; name: string; clientCompanyName: string };

const MEETING_URL_REGEX =
  /^https:\/\/(meet\.google\.com\/|zoom\.us\/j\/|teams\.microsoft\.com\/l\/meetup-join\/)/;

const LANGUAGE_OPTIONS = [
  { value: "auto", labelFr: "Détection automatique", labelEn: "Auto-detect" },
  { value: "fr", labelFr: "Français", labelEn: "French" },
  { value: "en", labelFr: "Anglais", labelEn: "English" },
  { value: "es", labelFr: "Espagnol", labelEn: "Spanish" },
];

export function RecallTranscriptForm({ deals }: { deals: DealOption[] }) {
  const router = useRouter();
  const { t, language: uiLanguage } = useI18n();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [meetingUrl, setMeetingUrl] = React.useState("");
  const [dealId, setDealId] = React.useState("");
  const [language, setLanguage] = React.useState("fr");

  const isValid =
    title.trim().length >= 3 && MEETING_URL_REGEX.test(meetingUrl.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/transcripts/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          meetingUrl: meetingUrl.trim(),
          dealId: dealId && dealId !== "none" ? dealId : null,
          language: language === "auto" ? null : language,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? t("transcripts.recall.error"));
        return;
      }

      toast.success(t("transcripts.recall.success"));
      router.replace("/dashboard/transcripts");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-card shadow-sm"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-3 rounded-md border border-blue-100 bg-blue-50/50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/30">
          <Radio className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {t("transcripts.recall.description")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recall-title">{t("transcripts.recall.titleLabel")}</Label>
          <Input
            id="recall-title"
            placeholder={t("transcripts.recall.titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="recall-meeting-url">{t("transcripts.recall.meetingUrl")}</Label>
          <Input
            id="recall-meeting-url"
            type="url"
            placeholder={t("transcripts.recall.meetingUrl.placeholder")}
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            {t("transcripts.recall.meetingUrl.help")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recall-language">
            {uiLanguage === "en" ? "Transcript language" : "Langue du transcript"}
          </Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="recall-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {uiLanguage === "en" ? opt.labelEn : opt.labelFr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {uiLanguage === "en"
              ? "Select the spoken language to improve transcription quality."
              : "Sélectionnez la langue parlée pour améliorer la qualité de la transcription."}
          </p>
        </div>

        {deals.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="recall-deal">{t("transcripts.recall.dealLabel")}</Label>
            <Select value={dealId} onValueChange={setDealId}>
              <SelectTrigger id="recall-deal">
                <SelectValue placeholder={t("transcripts.recall.noDeal")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("transcripts.recall.noDeal")}</SelectItem>
                {deals.map((deal) => (
                  <SelectItem key={deal.id} value={deal.id}>
                    {deal.name} — {deal.clientCompanyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t bg-muted/35 px-5 py-4 sm:px-6">
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/transcripts">
            <ArrowLeft className="mr-2 size-4" />
            {t("transcripts.detail.back")}
          </Link>
        </Button>
        <Button type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting ? t("transcripts.recall.submitting") : t("transcripts.recall.submit")}
        </Button>
      </div>
    </form>
  );
}
