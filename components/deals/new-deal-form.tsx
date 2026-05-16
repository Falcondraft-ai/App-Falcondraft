"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  FileText,
  MessageSquareText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SETTINGS_PREFERENCES_STORAGE_KEY = "falcondraft:settings-preferences";

const newDealSchema = z.object({
  name: z.string().trim().min(3, "Indiquez un intitulé de dossier."),
  clientCompanyName: z.string().trim().min(2, "Indiquez l’entreprise cliente."),
  amountEstimate: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 ||
        Number.isFinite(Number(value.replace(/\s/g, "").replace(",", "."))),
      {
        message: "Indiquez un montant valide.",
      },
    ),
  expectedCloseDate: z.string().trim().optional(),
  clientContactName: z.string().trim().min(2, "Indiquez le contact principal."),
  clientEmail: z.string().trim().email("Indiquez un email professionnel valide."),
  phone: z.string().trim().optional(),
  transcript: z
    .string()
    .trim()
    .min(20, "Ajoutez au moins quelques notes d’échange."),
  additionalContext: z.string().trim().optional(),
  emailInstructions: z.string().trim().optional(),
  clientCompanyInfo: z.string().trim().optional(),
});

type NewDealFormValues = z.infer<typeof newDealSchema>;
type NewDealField = keyof NewDealFormValues;

const defaultValues: NewDealFormValues = {
  name: "",
  clientCompanyName: "",
  amountEstimate: "",
  expectedCloseDate: "",
  clientContactName: "",
  clientEmail: "",
  phone: "",
  transcript: "",
  additionalContext: "",
  emailInstructions: "",
  clientCompanyInfo: "",
};

const onboardingSteps: Array<{
  title: string;
  eyebrow: string;
  description: string;
  fields: NewDealField[];
}> = [
  {
    eyebrow: "01",
    title: "Cadre du dossier",
    description:
      "Posez le nom du dossier, l’entreprise cliente et, si elle existe, l’enveloppe budgétaire.",
    fields: ["name", "clientCompanyName", "amountEstimate"],
  },
  {
    eyebrow: "02",
    title: "Contact client",
    description:
      "Identifiez la personne qui recevra les échanges et les documents.",
    fields: ["clientContactName", "clientEmail", "phone"],
  },
  {
    eyebrow: "03",
    title: "Notes d’échange",
    description:
      "Ajoutez la matière brute : transcript, brief, contraintes et attentes du client.",
    fields: ["transcript"],
  },
  {
    eyebrow: "04",
    title: "Consignes de sortie",
    description:
      "Précisez les angles importants, les consignes email et les informations utiles au devis.",
    fields: ["additionalContext", "emailInstructions", "clientCompanyInfo"],
  },
];

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
  const trimmedValue = value.trim().replace(/\s/g, "").replace(",", ".");
  return trimmedValue.length > 0 ? Number(trimmedValue) : undefined;
}

function getPreviewValue(value: string | undefined, fallback: string) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : fallback;
}

type ExistingTranscript = { id: string; title: string; createdAt: string };

export function NewDealForm({
  existingTranscripts = [],
}: {
  existingTranscripts?: ExistingTranscript[];
}) {
  const router = useRouter();
  const { language } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isImportingCompanyInfo, setIsImportingCompanyInfo] =
    React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [direction, setDirection] = React.useState(1);
  const [isLastStepReady, setIsLastStepReady] = React.useState(false);
  const [askExpectedCloseDate, setAskExpectedCloseDate] =
    React.useState(false);
  const [selectedTranscriptId, setSelectedTranscriptId] = React.useState<string>("");
  const form = useForm<NewDealFormValues>({
    resolver: zodResolver(newDealSchema),
    defaultValues,
    mode: "onTouched",
  });
  const copy =
    language === "en"
      ? {
          guided: "Guided creation",
          newDeal: "New deal",
          unnamedDeal: "Deal to name",
          clientMissing: "Client to specify",
          stepOf: `Step ${stepIndex + 1} of ${onboardingSteps.length}`,
          dealTitle: "Deal title",
          dealPlaceholder: "RFP response — regional office",
          dealHelp: "A concrete name the whole team can understand.",
          clientCompany: "Client company",
          clientPlaceholder: "Firm, developer, department...",
          budget: "Budget envelope",
          budgetHelp: "Optional, only if the client shared a budget.",
          closeDate: "Target close date",
          closeDateHelp:
            "Optional, useful if the deal must be ready before a specific date.",
          contactName: "Main contact",
          workEmail: "Work email",
          phone: "Phone",
          phoneHelp: "Optional, kept in the deal context.",
          transcript: "Transcript or call notes",
          transcriptPlaceholder:
            "Paste discovery notes, objectives, constraints, objections, deadlines, decision criteria, and next steps...",
          transcriptHelp:
            "The more precise the notes, the more useful the call summary and proposal will be.",
          context: "Additional context",
          contextPlaceholder:
            "Preferred references, sensitive points, political constraints, sales angle...",
          emailInstructions: "Email instructions",
          emailPlaceholder:
            "Message tone, points to mention, proposed next step...",
          companyInfo: "Company information for the quote",
          importing: "Importing…",
          importPappers: "Import from Pappers",
          searchPappers: "Search on Pappers",
          companyInfoPlaceholder:
            "Legal name, address, company ID, VAT number, billing email...",
          companyInfoHelp:
            "Paste useful quote information here: legal name, address, company ID, VAT number, billing email, etc.",
          deal: "Deal",
          client: "Client",
          contact: "Contact",
          missing: "To fill in",
          previous: "Previous",
          completed: `${Math.round(((stepIndex + 1) / onboardingSteps.length) * 100)}% complete`,
          creating: "Creating...",
          create: "Create deal",
          next: "Next",
        }
      : {
          guided: "Création guidée",
          newDeal: "Nouveau dossier",
          unnamedDeal: "Dossier à nommer",
          clientMissing: "Client à préciser",
          stepOf: `Étape ${stepIndex + 1} sur ${onboardingSteps.length}`,
          dealTitle: "Intitulé du dossier",
          dealPlaceholder: "Réponse appel d’offres — siège régional",
          dealHelp: "Un nom concret, compréhensible par toute l’équipe.",
          clientCompany: "Entreprise cliente",
          clientPlaceholder: "Cabinet, promoteur, direction...",
          budget: "Enveloppe budgétaire",
          budgetHelp:
            "Optionnel, seulement si le client a partagé une enveloppe.",
          closeDate: "Échéance cible",
          closeDateHelp:
            "Optionnel, utile si le dossier doit être prêt avant une date précise.",
          contactName: "Contact principal",
          workEmail: "Email professionnel",
          phone: "Téléphone",
          phoneHelp: "Optionnel, conservé dans le contexte du dossier.",
          transcript: "Transcript ou notes d’appel",
          transcriptPlaceholder:
            "Collez ici les notes de découverte, objectifs, contraintes, objections, délais, critères de décision et prochaines étapes...",
          transcriptHelp:
            "Plus les notes sont précises, plus le compte-rendu et la proposition seront exploitables.",
          context: "Contexte complémentaire",
          contextPlaceholder:
            "Références à privilégier, points sensibles, contraintes politiques, angle commercial...",
          emailInstructions: "Instructions email",
          emailPlaceholder:
            "Ton du message, points à mentionner, proposition de prochaine étape...",
          companyInfo: "Informations société pour le devis",
          importing: "Import en cours…",
          importPappers: "Importer depuis Pappers",
          searchPappers: "Rechercher sur Pappers",
          companyInfoPlaceholder:
            "Raison sociale, adresse, SIRET/SIREN, TVA intracommunautaire, email de facturation...",
          companyInfoHelp:
            "Collez ici les informations utiles pour le devis : raison sociale, adresse, SIRET/SIREN, TVA intracommunautaire, email de facturation, etc.",
          deal: "Dossier",
          client: "Client",
          contact: "Contact",
          missing: "À renseigner",
          previous: "Précédent",
          completed: `${Math.round(((stepIndex + 1) / onboardingSteps.length) * 100)}% complété`,
          creating: "Création...",
          create: "Créer le dossier",
          next: "Suivant",
        };

  React.useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(
        SETTINGS_PREFERENCES_STORAGE_KEY,
      );
      const parsedValue: unknown = storedValue ? JSON.parse(storedValue) : null;

      setAskExpectedCloseDate(
        Boolean(
          parsedValue &&
            typeof parsedValue === "object" &&
            "askExpectedCloseDate" in parsedValue &&
            parsedValue.askExpectedCloseDate === true,
        ),
      );
    } catch {
      setAskExpectedCloseDate(false);
    }
  }, []);

  const effectiveOnboardingSteps = React.useMemo(
    () =>
      onboardingSteps.map((step, index) =>
        index === 0 && askExpectedCloseDate
          ? {
              ...step,
              fields: [...step.fields, "expectedCloseDate" as const],
            }
          : step,
      ),
    [askExpectedCloseDate],
  );
  const currentStep = effectiveOnboardingSteps[stepIndex];
  const localizedSteps =
    language === "en"
      ? [
          {
            title: "Deal frame",
            description:
              "Set the deal name, client company, and budget envelope if there is one.",
          },
          {
            title: "Client contact",
            description:
              "Identify the person who will receive exchanges and documents.",
          },
          {
            title: "Call notes",
            description:
              "Add the raw material: transcript, brief, constraints, and client expectations.",
          },
          {
            title: "Output instructions",
            description:
              "Specify important angles, email instructions, and quote information.",
          },
        ]
      : onboardingSteps.map((step) => ({
          title: step.title,
          description: step.description,
        }));
  const isLastStep = stepIndex === effectiveOnboardingSteps.length - 1;
  const progress = ((stepIndex + 1) / effectiveOnboardingSteps.length) * 100;
  const values = useWatch({ control: form.control });

  React.useEffect(() => {
    if (!isLastStep) {
      setIsLastStepReady(false);
      return;
    }

    setIsLastStepReady(false);

    const timer = window.setTimeout(
      () => setIsLastStepReady(true),
      shouldReduceMotion ? 0 : 360,
    );

    return () => window.clearTimeout(timer);
  }, [isLastStep, shouldReduceMotion]);

  async function goToNextStep() {
    const isStepValid = await form.trigger(currentStep.fields, {
      shouldFocus: true,
    });

    if (!isStepValid) {
      return;
    }

    setDirection(1);
    setStepIndex((current) =>
      Math.min(current + 1, onboardingSteps.length - 1),
    );
  }

  function goToPreviousStep() {
    setDirection(-1);
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  async function importCompanyInfoFromPappers() {
    const companyName = form.getValues("clientCompanyName").trim();

    if (!companyName) {
      toast.error("Import impossible", {
        description: "Renseignez d’abord le nom de l’entreprise cliente.",
      });
      return;
    }

    setIsImportingCompanyInfo(true);

    const response = await fetch("/api/company-lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ companyName }),
    }).catch(() => null);

    setIsImportingCompanyInfo(false);

    const result: unknown = await response?.json().catch(() => null);

    if (!response?.ok) {
      toast.error("Import Pappers impossible", {
        description: getErrorMessage(
          result,
          "Utilisez le lien Pappers pour rechercher la société manuellement.",
        ),
      });
      return;
    }

    if (
      !result ||
      typeof result !== "object" ||
      !("companyInfo" in result) ||
      typeof result.companyInfo !== "string"
    ) {
      toast.error("Import Pappers incomplet", {
        description: "Utilisez le lien Pappers pour vérifier la société.",
      });
      return;
    }

    form.setValue("clientCompanyInfo", result.companyInfo, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    toast.success("Informations société importées", {
      description: "Vous pouvez les ajuster avant de créer le dossier.",
    });
  }

  async function onSubmit(valuesToSubmit: NewDealFormValues) {
    setIsSubmitting(true);

    const amountEstimate = toAmountPayload(valuesToSubmit.amountEstimate);
    const response = await fetch("/api/deals", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...valuesToSubmit,
        amountEstimate,
        expectedCloseDate: valuesToSubmit.expectedCloseDate || undefined,
        ...(selectedTranscriptId && selectedTranscriptId !== "none"
          ? { linkedTranscriptId: selectedTranscriptId }
          : {}),
      }),
    }).catch(() => null);

    if (!response?.ok) {
      setIsSubmitting(false);
      const result: unknown = await response?.json().catch(() => null);

      toast.error("Création impossible", {
        description: getErrorMessage(
          result,
          "Vérifiez les informations puis réessayez.",
        ),
      });
      return;
    }

    const result: unknown = await response.json().catch(() => null);
    const dealId =
      result &&
      typeof result === "object" &&
      "dealId" in result &&
      typeof result.dealId === "string"
        ? result.dealId
        : null;

    if (!dealId) {
      setIsSubmitting(false);
      toast.error("Création impossible", {
        description: "Le dossier a été créé, mais son identifiant est manquant.",
      });
      return;
    }

    toast.success("Dossier commercial créé.", {
      description: `${valuesToSubmit.name} est prêt pour le compte-rendu.`,
    });
    router.replace(`/dashboard/deals/${dealId}`);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => {
          if (!isLastStep || !isLastStepReady) {
            event.preventDefault();
            return;
          }

          void form.handleSubmit(onSubmit)(event);
        }}
      >
        <section className="overflow-hidden border bg-[#f1eadf] shadow-[0_24px_70px_-48px_rgba(22,31,48,0.62)] dark:bg-card/90">
          <div className="grid lg:min-h-[36rem] lg:grid-cols-[19rem_1fr]">
            <aside className="border-b border-[#26344d] bg-[#142033] px-5 py-5 text-[#f7f1e8] lg:border-r lg:border-b-0">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg border border-white/15 bg-white/10">
                  <FileText className="size-4" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-xs font-medium tracking-[0.16em] uppercase opacity-65">
                    {copy.guided}
                  </p>
                  <h2 className="mt-1 text-base font-semibold tracking-tight">
                    {copy.newDeal}
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
                {effectiveOnboardingSteps.map((step, index) => {
                  const isActive = index === stepIndex;
                  const isDone = index < stepIndex;

                  return (
                    <li key={step.title}>
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
                              {localizedSteps[index]?.title ?? step.title}
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

              <div className="mt-8 border-t border-white/10 pt-5 text-sm text-white/68">
                <p className="font-medium text-white/85">
                  {getPreviewValue(values.name, copy.unnamedDeal)}
                </p>
                <p className="mt-1">
                  {getPreviewValue(values.clientCompanyName, copy.clientMissing)}
                </p>
              </div>
            </aside>

            <div className="flex min-h-[32rem] flex-col bg-card/92">
              <div className="border-b px-5 py-5 sm:px-6">
                <p className="text-muted-foreground text-xs font-medium tracking-[0.12em] uppercase">
                  {copy.stepOf}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
                  {localizedSteps[stepIndex]?.title ?? currentStep.title}
                </h3>
                <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                  {localizedSteps[stepIndex]?.description ??
                    currentStep.description}
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
                    className="min-h-[21rem]"
                  >
                    {stepIndex === 0 ? (
                      <div className="grid gap-5 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>{copy.dealTitle}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={copy.dealPlaceholder}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {copy.dealHelp}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="clientCompanyName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{copy.clientCompany}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={copy.clientPlaceholder}
                                  {...field}
                                />
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
                              <FormLabel>{copy.budget}</FormLabel>
                              <FormControl>
                                <Input
                                  inputMode="decimal"
                                  placeholder="25 000"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {copy.budgetHelp}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {askExpectedCloseDate ? (
                          <FormField
                            control={form.control}
                            name="expectedCloseDate"
                            render={({ field }) => (
                              <FormItem className="md:col-span-2">
                                <FormLabel>{copy.closeDate}</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} />
                                </FormControl>
                                <FormDescription>
                                  {copy.closeDateHelp}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : null}
                      </div>
                    ) : null}

                    {stepIndex === 1 ? (
                      <div className="grid gap-5 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="clientContactName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{copy.contactName}</FormLabel>
                              <FormControl>
                                <Input placeholder="Prénom Nom" {...field} />
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
                              <FormLabel>{copy.workEmail}</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="contact@entreprise.fr"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{copy.phone}</FormLabel>
                              <FormControl>
                                <Input placeholder="+33 ..." {...field} />
                              </FormControl>
                              <FormDescription>
                                {copy.phoneHelp}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : null}

                    {stepIndex === 2 ? (
                      <div className="space-y-5">
                        {existingTranscripts.length > 0 && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              {language === "en" ? "Use an existing transcript" : "Utiliser un transcript existant"}
                            </label>
                            <Select
                              value={selectedTranscriptId}
                              onValueChange={(value) => {
                                setSelectedTranscriptId(value);
                                if (value && value !== "none") {
                                  fetch(`/api/transcripts/${value}`)
                                    .then((r) => r.json())
                                    .then((data: unknown) => {
                                      if (data && typeof data === "object" && "transcriptText" in data && typeof (data as { transcriptText: unknown }).transcriptText === "string") {
                                        form.setValue("transcript", (data as { transcriptText: string }).transcriptText, {
                                          shouldDirty: true,
                                          shouldTouch: true,
                                          shouldValidate: true,
                                        });
                                      }
                                    })
                                    .catch(() => {});
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={language === "en" ? "Select a transcript..." : "Sélectionner un transcript..."} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  {language === "en" ? "None — paste manually" : "Aucun — coller manuellement"}
                                </SelectItem>
                                {existingTranscripts.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {selectedTranscriptId && selectedTranscriptId !== "none" && (
                              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <MessageSquareText className="size-3.5" />
                                {language === "en" ? "Transcript linked — content imported below" : "Transcript lié — contenu importé ci-dessous"}
                              </div>
                            )}
                          </div>
                        )}
                        <FormField
                          control={form.control}
                          name="transcript"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{copy.transcript}</FormLabel>
                              <FormControl>
                                <Textarea
                                  rows={12}
                                  placeholder={copy.transcriptPlaceholder}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {copy.transcriptHelp}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : null}

                    {stepIndex === 3 ? (
                      <div className="space-y-5">
                        <FormField
                          control={form.control}
                          name="additionalContext"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{copy.context}</FormLabel>
                              <FormControl>
                                <Textarea
                                  rows={5}
                                  placeholder={copy.contextPlaceholder}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="emailInstructions"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{copy.emailInstructions}</FormLabel>
                              <FormControl>
                                <Textarea
                                  rows={4}
                                  placeholder={copy.emailPlaceholder}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="clientCompanyInfo"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <FormLabel>
                                  {copy.companyInfo}
                                </FormLabel>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  disabled={
                                    !values.clientCompanyName?.trim() ||
                                    isImportingCompanyInfo
                                  }
                                  onClick={() =>
                                    void importCompanyInfoFromPappers()
                                  }
                                >
                                  {isImportingCompanyInfo
                                    ? copy.importing
                                    : copy.importPappers}
                                </Button>
                                <Button
                                  asChild
                                  variant="outline"
                                  size="sm"
                                >
                                  <a
                                    href="https://www.pappers.fr/"
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {copy.searchPappers}
                                    <ExternalLink aria-hidden="true" />
                                  </a>
                                </Button>
                              </div>
                              <FormControl>
                                <Textarea
                                  rows={4}
                                  placeholder={copy.companyInfoPlaceholder}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {copy.companyInfoHelp}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid gap-3 border-t pt-4 text-sm md:grid-cols-3">
                          <div>
                            <p className="text-muted-foreground text-xs">
                              {copy.deal}
                            </p>
                            <p className="mt-1 font-medium">
                              {getPreviewValue(values.name, copy.missing)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">
                              {copy.client}
                            </p>
                            <p className="mt-1 font-medium">
                              {getPreviewValue(
                                values.clientCompanyName,
                                copy.missing,
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">
                              {copy.contact}
                            </p>
                            <p className="mt-1 font-medium">
                              {getPreviewValue(
                                values.clientContactName,
                                copy.missing,
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t bg-muted/35 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <Button
                  type="button"
                  variant="outline"
                  disabled={stepIndex === 0 || isSubmitting}
                  onClick={goToPreviousStep}
                >
                  <ArrowLeft aria-hidden="true" />
                  {copy.previous}
                </Button>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-muted-foreground hidden text-sm sm:inline">
                    {copy.completed}
                  </span>
                  {isLastStep ? (
                    <Button
                      type="submit"
                      disabled={isSubmitting || !isLastStepReady}
                    >
                      {isSubmitting ? copy.creating : copy.create}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void goToNextStep()}
                    >
                      {copy.next}
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </form>
    </Form>
  );
}
