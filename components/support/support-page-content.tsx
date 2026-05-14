"use client";

import {
  ArrowRight,
  Bug,
  CheckCircle2,
  ChevronDown,
  LifeBuoy,
  Lightbulb,
  Mail,
  MessageSquareText,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/translations";

const supportEmail = "support@falcondraft.fr";

const guideCards: Array<{
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: TranslationKey;
  description: TranslationKey;
}> = [
  {
    icon: Sparkles,
    title: "support.guides.start.title",
    description: "support.guides.start.description",
  },
  {
    icon: ShieldCheck,
    title: "support.guides.team.title",
    description: "support.guides.team.description",
  },
  {
    icon: CheckCircle2,
    title: "support.guides.validation.title",
    description: "support.guides.validation.description",
  },
];

const faqItems: Array<{
  question: TranslationKey;
  answer: TranslationKey;
}> = [
  {
    question: "support.faq.invite.question",
    answer: "support.faq.invite.answer",
  },
  {
    question: "support.faq.deal.question",
    answer: "support.faq.deal.answer",
  },
  {
    question: "support.faq.documents.question",
    answer: "support.faq.documents.answer",
  },
  {
    question: "support.faq.validation.question",
    answer: "support.faq.validation.answer",
  },
  {
    question: "support.faq.roles.question",
    answer: "support.faq.roles.answer",
  },
  {
    question: "support.faq.visibility.question",
    answer: "support.faq.visibility.answer",
  },
  {
    question: "support.faq.language.question",
    answer: "support.faq.language.answer",
  },
  {
    question: "support.faq.issue.question",
    answer: "support.faq.issue.answer",
  },
];

const requestTypes = ["question", "bug", "feature"] as const;

type RequestType = (typeof requestTypes)[number];

function requestTypeLabelKey(type: RequestType): TranslationKey {
  return `support.contact.type.${type}` as TranslationKey;
}

function requestTypeSubjectKey(type: RequestType): TranslationKey {
  return `support.contact.subject.${type}` as TranslationKey;
}

export function SupportPageContent() {
  const { language, t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const [openIndex, setOpenIndex] = React.useState(0);
  const [requestType, setRequestType] = React.useState<RequestType>("question");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const animation = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.42 },
      };

  async function sendSupportEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (message.trim().length < 10) {
      toast.error(t("support.contact.error"), {
        description: t("support.contact.messageTooShort"),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType,
          language,
          subject: subject.trim() || t(requestTypeSubjectKey(requestType)),
          message: message.trim(),
        }),
      });

      const result: unknown = await response.json().catch(() => ({}));
      const confirmationSent =
        typeof result === "object" &&
        result !== null &&
        "confirmationSent" in result &&
        result.confirmationSent === true;

      if (!response.ok) {
        throw new Error("support_request_failed");
      }

      setSubject("");
      setMessage("");

      toast.success(t("support.contact.sent"), {
        description: confirmationSent
          ? t("support.contact.sentDescription")
          : t("support.contact.sentNoConfirmation"),
      });
    } catch {
      toast.error(t("support.contact.error"), {
        description: t("support.contact.errorDescription"),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.04fr)_minmax(22rem,0.56fr)]">
      <motion.section
        {...animation}
        className="bg-card overflow-hidden rounded-2xl border shadow-sm"
      >
        <div className="relative border-b bg-[radial-gradient(circle_at_12%_0%,rgba(198,154,97,0.28),transparent_24rem),linear-gradient(135deg,#132033,#1c2a40)] p-6 text-[#f8f1e7] sm:p-8">
          <div className="absolute top-5 right-5 hidden rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/70 backdrop-blur sm:block">
            {t("support.hero.badge")}
          </div>
          <div className="max-w-2xl">
            <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">
              <LifeBuoy className="mr-1 size-3.5" aria-hidden="true" />
              {t("support.hero.kicker")}
            </Badge>
            <h2 className="mt-5 max-w-xl text-2xl font-semibold tracking-[-0.045em] sm:text-4xl">
              {t("support.hero.title")}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
              {t("support.hero.description")}
            </p>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
          {guideCards.map((card, index) => {
            const Icon = card.icon;

            return (
              <motion.article
                key={card.title}
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
                animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{
                  duration: 0.35,
                  delay: shouldReduceMotion ? 0 : index * 0.05,
                }}
                className="group bg-background/65 hover:border-primary/35 rounded-xl border p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-sm motion-reduce:hover:translate-y-0"
              >
                <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105">
                  <Icon className="size-4" strokeWidth={1.75} />
                </div>
                <h3 className="mt-4 text-sm font-semibold">{t(card.title)}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-6">
                  {t(card.description)}
                </p>
              </motion.article>
            );
          })}
        </div>

        <div className="border-t p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold tracking-[-0.02em]">
                {t("support.faq.title")}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {t("support.faq.description")}
              </p>
            </div>
            <div className="bg-muted hidden size-10 items-center justify-center rounded-full sm:flex">
              <Search className="text-muted-foreground size-4" />
            </div>
          </div>

          <div className="space-y-2">
            {faqItems.map((item, index) => {
              const isOpen = openIndex === index;

              return (
                <div
                  key={item.question}
                  className={cn(
                    "rounded-xl border transition-colors",
                    isOpen
                      ? "border-primary/35 bg-primary/[0.035]"
                      : "bg-background/70 hover:bg-muted/35",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                  >
                    <span className="text-sm font-medium">
                      {t(item.question)}
                    </span>
                    <ChevronDown
                      className={cn(
                        "text-muted-foreground size-4 shrink-0 transition-transform duration-300",
                        isOpen ? "rotate-180" : null,
                      )}
                      strokeWidth={1.75}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={
                          shouldReduceMotion
                            ? undefined
                            : { height: 0, opacity: 0 }
                        }
                        animate={
                          shouldReduceMotion
                            ? undefined
                            : { height: "auto", opacity: 1 }
                        }
                        exit={
                          shouldReduceMotion
                            ? undefined
                            : { height: 0, opacity: 0 }
                        }
                        transition={{ duration: 0.24 }}
                        className="overflow-hidden"
                      >
                        <p className="text-muted-foreground px-4 pb-4 text-sm leading-6">
                          {t(item.answer)}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>

      <motion.aside {...animation} transition={{ duration: 0.42, delay: 0.08 }}>
        <Card className="sticky top-24 rounded-2xl shadow-sm">
          <CardHeader className="border-b">
            <Badge variant="outline" className="w-fit">
              <Mail className="mr-1 size-3.5" aria-hidden="true" />
              {supportEmail}
            </Badge>
            <CardTitle>{t("support.contact.title")}</CardTitle>
            <CardDescription>
              {t("support.contact.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={sendSupportEmail}>
              <div className="grid gap-2">
                <Label htmlFor="support-type">
                  {t("support.contact.typeLabel")}
                </Label>
                <Select
                  value={requestType}
                  disabled={isSubmitting}
                  onValueChange={(value) =>
                    setRequestType(value as RequestType)
                  }
                >
                  <SelectTrigger id="support-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {requestTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(requestTypeLabelKey(type))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="support-subject">
                  {t("support.contact.subjectLabel")}
                </Label>
                <Input
                  id="support-subject"
                  value={subject}
                  disabled={isSubmitting}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder={t("support.contact.subjectPlaceholder")}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="support-message">
                  {t("support.contact.messageLabel")}
                </Label>
                <Textarea
                  id="support-message"
                  value={message}
                  disabled={isSubmitting}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={t("support.contact.messagePlaceholder")}
                  className="min-h-36 resize-none"
                  required
                />
              </div>

              <Button
                type="submit"
                className="group w-full"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? t("support.contact.sending")
                  : t("support.contact.submit")}
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="bg-card rounded-xl border p-4 shadow-sm">
            <Bug className="text-primary size-4" />
            <p className="mt-2 text-sm font-medium">
              {t("support.quick.bug.title")}
            </p>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {t("support.quick.bug.description")}
            </p>
          </div>
          <div className="bg-card rounded-xl border p-4 shadow-sm">
            <Lightbulb className="text-primary size-4" />
            <p className="mt-2 text-sm font-medium">
              {t("support.quick.idea.title")}
            </p>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {t("support.quick.idea.description")}
            </p>
          </div>
          <div className="bg-card rounded-xl border p-4 shadow-sm sm:col-span-2 xl:col-span-1">
            <MessageSquareText className="text-primary size-4" />
            <p className="mt-2 text-sm font-medium">
              {t("support.quick.question.title")}
            </p>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {t("support.quick.question.description")}
            </p>
          </div>
        </div>
      </motion.aside>
    </div>
  );
}
