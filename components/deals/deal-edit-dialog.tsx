"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp, ExternalLink, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Deal } from "@/types/deal";

const SETTINGS_PREFERENCES_STORAGE_KEY = "falcondraft:settings-preferences";

const emptyableFallbacks = new Set([
  "Client à renseigner",
  "Email à renseigner",
  "Contact à renseigner",
  "Aucune note d’appel renseignée.",
  "Contexte complémentaire à préciser si nécessaire.",
  "Consignes email à préciser si nécessaire.",
  "Le compte-rendu sera disponible après génération.",
  "La proposition sera disponible après génération.",
]);

const dealEditSchema = z.object({
  name: z.string().trim().min(3, "Indiquez un intitulé de dossier."),
  clientCompanyName: z.string().trim().min(2, "Indiquez l’entreprise cliente."),
  clientContactName: z.string().trim().min(2, "Indiquez le contact principal."),
  clientEmail: z.string().trim().email("Indiquez un email professionnel valide."),
  clientPhone: z.string().trim().optional(),
  amountEstimate: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 || Number.isFinite(Number(value.replace(",", "."))),
      {
        message: "Indiquez un montant valide.",
      },
    ),
  expectedCloseDate: z.string().trim().optional(),
  transcript: z.string().trim().min(1, "Ajoutez les notes du dossier."),
  additionalContext: z.string().trim().optional(),
  emailInstructions: z.string().trim().optional(),
  clientCompanyInfo: z.string().trim().optional(),
  callSummary: z.string().trim().optional(),
  proposalContent: z.string().trim().optional(),
});

type DealEditFormValues = z.infer<typeof dealEditSchema>;

function cleanEditableValue(value: string) {
  return emptyableFallbacks.has(value) ? "" : value;
}

function getErrorMessage(result: unknown, fallback: string) {
  if (
    result &&
    typeof result === "object" &&
    "message" in result &&
    typeof result.message === "string"
  ) {
    return result.message;
  }

  return fallback;
}

function toAmountPayload(value: string) {
  const trimmedValue = value.trim().replace(",", ".");
  return trimmedValue.length > 0 ? Number(trimmedValue) : null;
}

function CollapsibleSection({
  label,
  preview,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  preview: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        onClick={onToggle}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          {!expanded && preview && (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {preview}
            </p>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        )}
      </button>
      <div className={cn("border-t px-3 pb-3 pt-2", !expanded && "hidden")}>
        {children}
      </div>
    </div>
  );
}

function buildDefaultValues(deal: Deal): DealEditFormValues {
  return {
    name: deal.name,
    clientCompanyName: cleanEditableValue(deal.clientCompanyName),
    clientContactName: cleanEditableValue(deal.clientContactName),
    clientEmail: cleanEditableValue(deal.clientEmail),
    clientPhone: deal.clientPhone ?? "",
    amountEstimate:
      deal.amountEstimate > 0 ? String(deal.amountEstimate) : "",
    expectedCloseDate: deal.expectedCloseDate ?? "",
    transcript: cleanEditableValue(deal.transcript),
    additionalContext: cleanEditableValue(deal.additionalContext),
    emailInstructions: cleanEditableValue(deal.emailInstructions),
    clientCompanyInfo: deal.clientCompanyInfo ?? "",
    callSummary: cleanEditableValue(deal.callSummary),
    proposalContent: cleanEditableValue(deal.proposalExcerpt),
  };
}

export function DealEditDialog({
  deal,
  triggerLabel = "Modifier",
  triggerSize = "sm",
}: {
  deal: Deal;
  triggerLabel?: React.ReactNode;
  triggerSize?: "sm" | "default";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [showExpectedCloseDate, setShowExpectedCloseDate] = React.useState(
    Boolean(deal.expectedCloseDate),
  );
  const form = useForm<DealEditFormValues>({
    resolver: zodResolver(dealEditSchema),
    defaultValues: buildDefaultValues(deal),
  });

  React.useEffect(() => {
    if (open) {
      form.reset(buildDefaultValues(deal));

      try {
        const storedValue = window.localStorage.getItem(
          SETTINGS_PREFERENCES_STORAGE_KEY,
        );
        const parsedValue: unknown = storedValue ? JSON.parse(storedValue) : null;

        setShowExpectedCloseDate(
          Boolean(
            deal.expectedCloseDate ||
              (parsedValue &&
                typeof parsedValue === "object" &&
                "askExpectedCloseDate" in parsedValue &&
                parsedValue.askExpectedCloseDate === true),
          ),
        );
      } catch {
        setShowExpectedCloseDate(Boolean(deal.expectedCloseDate));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, open]);

  async function onSubmit(values: DealEditFormValues) {
    setIsSubmitting(true);

    const response = await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: values.name,
        clientCompanyName: values.clientCompanyName,
        clientContactName: values.clientContactName,
        clientEmail: values.clientEmail,
        clientPhone: values.clientPhone,
        amountEstimate: toAmountPayload(values.amountEstimate),
        expectedCloseDate: values.expectedCloseDate || undefined,
        transcript: values.transcript,
        additionalContext: values.additionalContext,
        emailInstructions: values.emailInstructions,
        clientCompanyInfo: values.clientCompanyInfo,
        callSummary: values.callSummary,
        proposalContent: values.proposalContent,
      }),
    }).catch(() => null);

    setIsSubmitting(false);

    if (!response?.ok) {
      const result: unknown = await response?.json().catch(() => null);
      toast.error("Modification impossible", {
        description: getErrorMessage(
          result,
          "Le dossier commercial n’a pas pu être modifié.",
        ),
      });
      return;
    }

    toast.success("Dossier commercial modifié", {
      description: "Les informations ont été enregistrées.",
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size={triggerSize}>
          <Pencil aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle>Modifier le dossier</DialogTitle>
          <DialogDescription>
            Ajustez les informations commerciales, le contact email et les notes
            utilisées pour la production documentaire.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Intitulé du dossier</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientCompanyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entreprise cliente</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact principal</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email professionnel</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amountEstimate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enveloppe budgétaire</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="12000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="+33 ..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {showExpectedCloseDate ? (
                <FormField
                  control={form.control}
                  name="expectedCloseDate"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Échéance cible</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>

            <div className="space-y-3 border-t px-5 py-5">
              <CollapsibleSection
                label="Transcript et notes d’appel"
                preview={form.getValues("transcript")?.slice(0, 80) ?? ""}
                expanded={expandedSections.has("transcript")}
                onToggle={() => setExpandedSections((s) => {
                  const next = new Set(s);
                  next.has("transcript") ? next.delete("transcript") : next.add("transcript");
                  return next;
                })}
              >
                <FormField
                  control={form.control}
                  name="transcript"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea rows={10} className="font-mono text-xs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleSection>

              <CollapsibleSection
                label="Contexte complémentaire"
                preview={form.getValues("additionalContext")?.slice(0, 80) ?? ""}
                expanded={expandedSections.has("additionalContext")}
                onToggle={() => setExpandedSections((s) => {
                  const next = new Set(s);
                  next.has("additionalContext") ? next.delete("additionalContext") : next.add("additionalContext");
                  return next;
                })}
              >
                <FormField
                  control={form.control}
                  name="additionalContext"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          rows={5}
                          placeholder="Références, contraintes, priorités ou points sensibles."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleSection>

              <CollapsibleSection
                label="Instructions email"
                preview={form.getValues("emailInstructions")?.slice(0, 80) ?? ""}
                expanded={expandedSections.has("emailInstructions")}
                onToggle={() => setExpandedSections((s) => {
                  const next = new Set(s);
                  next.has("emailInstructions") ? next.delete("emailInstructions") : next.add("emailInstructions");
                  return next;
                })}
              >
                <FormField
                  control={form.control}
                  name="emailInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder="Ton du message, points à mentionner, prochaine étape."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleSection>

              <CollapsibleSection
                label="Informations société pour le devis"
                preview={form.getValues("clientCompanyInfo")?.slice(0, 80) ?? ""}
                expanded={expandedSections.has("clientCompanyInfo")}
                onToggle={() => setExpandedSections((s) => {
                  const next = new Set(s);
                  next.has("clientCompanyInfo") ? next.delete("clientCompanyInfo") : next.add("clientCompanyInfo");
                  return next;
                })}
              >
                <FormField
                  control={form.control}
                  name="clientCompanyInfo"
                  render={({ field }) => (
                    <FormItem>
                      <div className="mb-2 flex justify-end">
                        <Button asChild variant="outline" size="sm">
                          <a
                            href="https://www.pappers.fr/"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Rechercher sur Pappers
                            <ExternalLink aria-hidden="true" />
                          </a>
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder="Raison sociale, adresse, SIRET/SIREN, TVA intracommunautaire, email de facturation..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleSection>

              <CollapsibleSection
                label="Compte-rendu"
                preview={form.getValues("callSummary")?.slice(0, 80) ?? ""}
                expanded={expandedSections.has("callSummary")}
                onToggle={() => setExpandedSections((s) => {
                  const next = new Set(s);
                  next.has("callSummary") ? next.delete("callSummary") : next.add("callSummary");
                  return next;
                })}
              >
                <FormField
                  control={form.control}
                  name="callSummary"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          rows={6}
                          placeholder="Compte-rendu à compléter après génération ou validation."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleSection>

              <CollapsibleSection
                label="Contenu de proposition"
                preview={form.getValues("proposalContent")?.slice(0, 80) ?? ""}
                expanded={expandedSections.has("proposalContent")}
                onToggle={() => setExpandedSections((s) => {
                  const next = new Set(s);
                  next.has("proposalContent") ? next.delete("proposalContent") : next.add("proposalContent");
                  return next;
                })}
              >
                <FormField
                  control={form.control}
                  name="proposalContent"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          rows={6}
                          placeholder="Contenu de proposition à ajuster si nécessaire."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleSection>
            </div>

            <div className="flex justify-end gap-2 border-t bg-muted/35 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
