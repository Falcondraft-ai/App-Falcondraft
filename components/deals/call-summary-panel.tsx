"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { LoadingDots } from "@/components/common/loading-dots";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CALL_SUMMARY_GENERATION_EVENT,
  getCallSummaryGenerationStorageKey,
} from "@/lib/workflow-progress";
import { cn } from "@/lib/utils";

type SummarySection = {
  number: string;
  title: string;
  items: string[];
};

function cleanMarkdownBlock(value: string) {
  return value.replace(/^#{1,6}\s+/gm, "").trim();
}

function cleanMarkdownTitle(value: string) {
  return cleanMarkdownBlock(value)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function cleanMarkdownText(value: string) {
  return cleanMarkdownBlock(value)
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function splitSummaryItems(body: string) {
  return cleanMarkdownBlock(body)
    .replace(/^\s*[-•]\s+/, "")
    .split(/\n+\s*[-•]\s+|\s+-\s+/)
    .map((item) => cleanMarkdownText(item))
    .filter(Boolean);
}

function FormattedSummaryText({ value }: { value: string }) {
  const parts = cleanMarkdownText(value).split(/(\*\*[^*]+?\*\*|__[^_]+?__)/g);

  return (
    <>
      {parts.map((part, index) => {
        const isBold =
          (part.startsWith("**") && part.endsWith("**")) ||
          (part.startsWith("__") && part.endsWith("__"));

        if (isBold) {
          return (
            <strong key={`${part}-${index}`} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }

        return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
      })}
    </>
  );
}

function normalizeSummary(summary: string) {
  return cleanMarkdownBlock(summary)
    .replace(/\r/g, "")
    .replace(/\s*[-—]{2,}\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function parseCallSummary(summary: string): SummarySection[] {
  const normalizedSummary = normalizeSummary(summary);
  const numberedSummary = normalizedSummary.includes("\n1.")
    ? normalizedSummary
    : normalizedSummary.replace(/(\s)(\d+\.\s)/g, "\n$2");

  const sections = numberedSummary
    .split(/\n(?=\d+\.\s)/)
    .map((section) => section.trim())
    .filter(Boolean)
    .map<SummarySection | null>((section) => {
      const match = section.match(
        /^(\d+)\.\s*([^–—\-\n]+)(?:\s*[–—-]\s*)?([\s\S]*)$/,
      );

      if (!match) {
        return null;
      }

      const body = match[3]?.trim() ?? "";
      const items = splitSummaryItems(body);

      return {
        number: match[1],
        title: cleanMarkdownTitle(match[2]),
        items: items.length > 0 ? items : [cleanMarkdownText(body)],
      };
    })
    .filter((section): section is SummarySection => Boolean(section));

  if (sections.length > 0) {
    return sections;
  }

  return [
    {
      number: "1",
      title: "Compte-rendu",
      items: [cleanMarkdownText(summary)],
    },
  ];
}

function SummarySectionList({
  sections,
  compact = false,
}: {
  sections: SummarySection[];
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <section
          key={`${section.number}-${section.title}`}
          className="border-l-2 border-primary/70 pl-3"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-primary font-mono text-xs">
              {section.number.padStart(2, "0")}
            </span>
            <h4 className="text-sm font-semibold">{section.title}</h4>
          </div>
          {section.items.length > 1 ? (
            <ul className="text-muted-foreground mt-2 space-y-1.5 text-sm leading-6">
              {section.items
                .slice(0, compact ? 3 : undefined)
                .map((item, itemIndex) => (
                  <li
                    key={`${section.number}-${itemIndex}`}
                    className="flex gap-2"
                  >
                    <span className="mt-2 size-1 shrink-0 bg-primary/70" />
                    <span>
                      <FormattedSummaryText value={item} />
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              <FormattedSummaryText value={section.items[0]} />
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

export function CallSummaryPanel({
  dealId,
  summary,
  hasSummary,
}: {
  dealId: string;
  summary: string;
  hasSummary: boolean;
}) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const sections = React.useMemo(() => parseCallSummary(summary), [summary]);
  const [isPolling, setIsPolling] = React.useState(false);
  const [justCompleted, setJustCompleted] = React.useState(false);
  const [isDeletingSummary, setIsDeletingSummary] = React.useState(false);
  const [isLocallyDeleted, setIsLocallyDeleted] = React.useState(false);
  const previousHasSummaryRef = React.useRef(hasSummary);
  const effectiveHasSummary = hasSummary && !isLocallyDeleted;
  const previewSections = sections.slice(0, 3);

  React.useEffect(() => {
    if (hasSummary) {
      setIsLocallyDeleted(false);
    }
  }, [hasSummary, summary]);

  React.useEffect(() => {
    const storageKey = getCallSummaryGenerationStorageKey(dealId);
    const hadGenerationFlag = Boolean(window.localStorage.getItem(storageKey));
    const becameAvailable =
      effectiveHasSummary && !previousHasSummaryRef.current;

    function syncGenerationState() {
      setIsPolling(Boolean(window.localStorage.getItem(storageKey)));
    }

    if (effectiveHasSummary) {
      if (hadGenerationFlag) {
        window.localStorage.removeItem(storageKey);
      }

      setIsPolling(false);
      previousHasSummaryRef.current = true;

      if (becameAvailable) {
        setJustCompleted(true);
        toast.success("Compte-rendu prêt", {
          description: "Le compte-rendu est disponible dans le dossier.",
        });

        const timer = window.setTimeout(() => setJustCompleted(false), 3200);
        return () => window.clearTimeout(timer);
      }

      return;
    }

    previousHasSummaryRef.current = false;
    syncGenerationState();
    window.addEventListener("storage", syncGenerationState);
    window.addEventListener(CALL_SUMMARY_GENERATION_EVENT, syncGenerationState);

    return () => {
      window.removeEventListener("storage", syncGenerationState);
      window.removeEventListener(
        CALL_SUMMARY_GENERATION_EVENT,
        syncGenerationState,
      );
    };
  }, [dealId, effectiveHasSummary]);

  React.useEffect(() => {
    if (effectiveHasSummary) {
      return;
    }

    const intervalDuration = isPolling ? 3500 : 7000;
    const interval = window.setInterval(() => {
      router.refresh();
    }, intervalDuration);

    return () => window.clearInterval(interval);
  }, [effectiveHasSummary, isPolling, router]);

  async function deleteCallSummary() {
    const confirmed = window.confirm(
      "Supprimer le compte-rendu ? Vous pourrez modifier le dossier puis le régénérer ensuite.",
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingSummary(true);

    const response = await fetch(`/api/deals/${dealId}/call-summary`, {
      method: "DELETE",
    }).catch(() => null);

    setIsDeletingSummary(false);

    if (!response?.ok) {
      const result: unknown = await response?.json().catch(() => null);
      const message =
        result &&
        typeof result === "object" &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : "Le compte-rendu n’a pas pu être supprimé.";

      toast.error("Suppression impossible", {
        description: message,
      });
      return;
    }

    window.localStorage.removeItem(getCallSummaryGenerationStorageKey(dealId));
    window.dispatchEvent(new Event(CALL_SUMMARY_GENERATION_EVENT));
    setIsLocallyDeleted(true);
    toast.success("Compte-rendu supprimé", {
      description: "Vous pouvez modifier le dossier puis relancer la génération.",
    });
    router.refresh();
  }

  if (!effectiveHasSummary) {
    return (
      <div className="border bg-muted/35 p-3">
        <p className="text-sm font-medium">
          {isPolling ? (
            <>
              Génération du compte-rendu en cours
              <LoadingDots />
            </>
          ) : (
            "Compte-rendu en attente"
          )}
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          {isPolling
            ? "La page se mettra à jour automatiquement dès que le compte-rendu sera disponible."
            : "Lancez la génération depuis le panneau d’actions pour préparer cette section."}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden border bg-card p-3",
        justCompleted ? "border-primary/80" : "border-border",
      )}
    >
      {justCompleted && !shouldReduceMotion ? (
        <motion.div
          className="pointer-events-none absolute inset-0 border-2 border-primary"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.6, ease: "easeOut" }}
        />
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium">Compte-rendu structuré</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Lecture synthétique des points clés extraits du dossier.
          </p>
        </div>
        <Dialog>
          <div className="flex flex-wrap gap-2">
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <ExternalLink aria-hidden="true" />
                Ouvrir
              </Button>
            </DialogTrigger>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isDeletingSummary}
              onClick={() => void deleteCallSummary()}
            >
              <Trash2 aria-hidden="true" />
              {isDeletingSummary ? "Suppression..." : "Supprimer"}
            </Button>
          </div>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Compte-rendu complet</DialogTitle>
              <DialogDescription>
                Version complète et structurée du compte-rendu commercial.
              </DialogDescription>
            </DialogHeader>
            <SummarySectionList sections={sections} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4">
        <SummarySectionList sections={previewSections} compact />
      </div>

      {sections.length > previewSections.length ? (
        <p className="text-muted-foreground mt-3 text-xs">
          {sections.length - previewSections.length} section(s) supplémentaire(s)
          dans la vue complète.
        </p>
      ) : null}
    </motion.div>
  );
}
