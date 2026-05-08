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
  getProposalGenerationStorageKey,
  PROPOSAL_GENERATION_EVENT,
} from "@/lib/workflow-progress";
import { cn } from "@/lib/utils";

type ProposalSection = {
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

function splitItems(body: string) {
  return cleanMarkdownBlock(body)
    .replace(/^\s*[-•]\s+/, "")
    .split(/\n+\s*[-•]\s+|\s+-\s+/)
    .map((item) => cleanMarkdownText(item))
    .filter(Boolean);
}

function FormattedDocumentText({ value }: { value: string }) {
  const parts = cleanMarkdownText(value).split(/(\*\*[^*]+?\*\*|__[^_]+?__)/g);

  return (
    <>
      {parts.map((part, index) => {
        const isBold =
          (part.startsWith("**") && part.endsWith("**")) ||
          (part.startsWith("__") && part.endsWith("__"));

        if (isBold) {
          return (
            <strong
              key={`${part}-${index}`}
              className="font-semibold text-foreground"
            >
              {part.slice(2, -2)}
            </strong>
          );
        }

        return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
      })}
    </>
  );
}

function parseProposalContent(content: string): ProposalSection[] {
  const normalizedContent = cleanMarkdownBlock(content)
    .replace(/\r/g, "")
    .replace(/\s*[-—]{2,}\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  const numberedContent = normalizedContent.includes("\n1.")
    ? normalizedContent
    : normalizedContent.replace(/(\s)(\d+\.\s)/g, "\n$2");

  const sections = numberedContent
    .split(/\n(?=\d+\.\s)/)
    .map((section) => section.trim())
    .filter(Boolean)
    .map<ProposalSection | null>((section) => {
      const match = section.match(
        /^(\d+)\.\s*([^–—\-\n]+)(?:\s*[–—-]\s*)?([\s\S]*)$/,
      );

      if (!match) {
        return null;
      }

      const body = match[3]?.trim() ?? "";
      const items = splitItems(body);

      return {
        number: match[1],
        title: cleanMarkdownTitle(match[2]),
        items: items.length > 0 ? items : [cleanMarkdownText(body)],
      };
    })
    .filter((section): section is ProposalSection => Boolean(section));

  if (sections.length > 0) {
    return sections;
  }

  return [
    {
      number: "1",
      title: "Contenu de la proposition",
      items: [cleanMarkdownText(content)],
    },
  ];
}

function ProposalSectionList({
  sections,
  compact = false,
}: {
  sections: ProposalSection[];
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
                      <FormattedDocumentText value={item} />
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              <FormattedDocumentText value={section.items[0]} />
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

export function ProposalPanel({
  dealId,
  content,
  hasProposal,
  editUrl,
}: {
  dealId: string;
  content: string;
  hasProposal: boolean;
  editUrl?: string;
}) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const sections = React.useMemo(() => parseProposalContent(content), [content]);
  const [isPolling, setIsPolling] = React.useState(false);
  const [justCompleted, setJustCompleted] = React.useState(false);
  const [isDeletingProposal, setIsDeletingProposal] = React.useState(false);
  const [isLocallyDeleted, setIsLocallyDeleted] = React.useState(false);
  const previousHasProposalRef = React.useRef(hasProposal);
  const effectiveHasProposal = hasProposal && !isLocallyDeleted;
  const previewSections = sections.slice(0, 3);

  React.useEffect(() => {
    if (hasProposal) {
      setIsLocallyDeleted(false);
    }
  }, [hasProposal, content]);

  React.useEffect(() => {
    const storageKey = getProposalGenerationStorageKey(dealId);
    const hadGenerationFlag = Boolean(window.localStorage.getItem(storageKey));
    const becameAvailable =
      effectiveHasProposal && !previousHasProposalRef.current;

    function syncGenerationState() {
      setIsPolling(Boolean(window.localStorage.getItem(storageKey)));
    }

    if (effectiveHasProposal) {
      if (hadGenerationFlag) {
        window.localStorage.removeItem(storageKey);
      }

      setIsPolling(false);
      previousHasProposalRef.current = true;

      if (becameAvailable) {
        setJustCompleted(true);
        toast.success("Proposition prête", {
          description: "La proposition est disponible dans le dossier.",
        });

        const timer = window.setTimeout(() => setJustCompleted(false), 3200);
        return () => window.clearTimeout(timer);
      }

      return;
    }

    previousHasProposalRef.current = false;
    syncGenerationState();
    window.addEventListener("storage", syncGenerationState);
    window.addEventListener(PROPOSAL_GENERATION_EVENT, syncGenerationState);

    return () => {
      window.removeEventListener("storage", syncGenerationState);
      window.removeEventListener(PROPOSAL_GENERATION_EVENT, syncGenerationState);
    };
  }, [dealId, effectiveHasProposal]);

  React.useEffect(() => {
    if (effectiveHasProposal) {
      return;
    }

    const intervalDuration = isPolling ? 3500 : 7000;
    const interval = window.setInterval(() => {
      router.refresh();
    }, intervalDuration);

    return () => window.clearInterval(interval);
  }, [effectiveHasProposal, isPolling, router]);

  async function deleteProposal() {
    const confirmed = window.confirm(
      "Supprimer la proposition ? Vous pourrez modifier le dossier puis la régénérer ensuite.",
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingProposal(true);

    const response = await fetch(`/api/deals/${dealId}/proposal`, {
      method: "DELETE",
    }).catch(() => null);

    setIsDeletingProposal(false);

    if (!response?.ok) {
      const result: unknown = await response?.json().catch(() => null);
      const message =
        result &&
        typeof result === "object" &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : "La proposition n’a pas pu être supprimée.";

      toast.error("Suppression impossible", {
        description: message,
      });
      return;
    }

    window.localStorage.removeItem(getProposalGenerationStorageKey(dealId));
    window.dispatchEvent(new Event(PROPOSAL_GENERATION_EVENT));
    setIsLocallyDeleted(true);
    toast.success("Proposition supprimée", {
      description: "Vous pouvez modifier le dossier puis relancer la génération.",
    });
    router.refresh();
  }

  if (!effectiveHasProposal) {
    return (
      <div className="border bg-muted/35 p-3">
        <p className="text-sm font-medium">
          {isPolling ? (
            <>
              Génération de la proposition en cours
              <LoadingDots />
            </>
          ) : (
            "Proposition en attente"
          )}
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          {isPolling
            ? "La page se mettra à jour automatiquement dès que la proposition sera disponible."
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
          <p className="text-sm font-medium">Lien d’édition</p>
          {editUrl ? (
            <a
              href={editUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary mt-1 inline-flex text-sm font-medium hover:underline"
            >
              Ouvrir l’espace d’édition
            </a>
          ) : (
            <p className="text-muted-foreground mt-1 text-sm">
              Lien disponible après synchronisation de la proposition.
            </p>
          )}
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
              disabled={isDeletingProposal}
              onClick={() => void deleteProposal()}
            >
              <Trash2 aria-hidden="true" />
              {isDeletingProposal ? "Suppression..." : "Supprimer"}
            </Button>
          </div>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Contenu de la proposition</DialogTitle>
              <DialogDescription>
                Version complète et structurée de la proposition commerciale.
              </DialogDescription>
            </DialogHeader>
            <ProposalSectionList sections={sections} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 border-t pt-4">
        <p className="mb-3 text-sm font-medium">Contenu de la proposition</p>
        <ProposalSectionList sections={previewSections} compact />
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
