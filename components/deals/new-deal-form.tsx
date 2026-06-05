"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  FileAudio,
  FileText,
  Mic,
  Radio,
  MessageSquareText,
  Upload,
  X,
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
import { getLocalizedCopy } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

const SETTINGS_PREFERENCES_STORAGE_KEY = "falcondraft:settings-preferences";

const newDealSchema = z
  .object({
    name: z.string().trim().min(3, "Indiquez un intitulé de dossier."),
    clientCompanyName: z.string().trim().min(2, "Indiquez l’entreprise cliente."),
    quotePriceHt: z
      .string()
      .trim()
      .refine(
        (value) =>
          Number.isFinite(Number(value.replace(/\s/g, "").replace(",", "."))) &&
          Number(value.replace(/\s/g, "").replace(",", ".")) > 0,
        {
          message: "Indiquez un prix HT valide.",
        },
      ),
    expectedCloseDate: z.string().trim().optional(),
    clientContactName: z.string().trim().min(2, "Indiquez le contact principal."),
    clientEmail: z
      .string()
      .trim()
      .email("Indiquez un email professionnel valide."),
    phone: z.string().trim().optional(),
    transcript: z.string().trim().optional(),
    additionalContext: z.string().trim().optional(),
    emailInstructions: z.string().trim().optional(),
    quoteClientType: z.enum(["company", "individual"]),
    quoteTaxRate: z
      .string()
      .trim()
      .refine(
        (value) => ["0", "5.5", "10", "20"].includes(value),
        { message: "Sélectionnez un taux de TVA valide." },
      ),
    clientCompanyInfo: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const info = data.clientCompanyInfo?.trim();
    if (!info || info.length === 0) {
      if (data.quoteClientType === "company") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Indiquez les informations société : adresse de facturation et SIRET/SIREN.",
          path: ["clientCompanyInfo"],
        });
      } else {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Indiquez l'adresse de facturation du particulier.",
          path: ["clientCompanyInfo"],
        });
      }
    }
  });

type NewDealFormValues = z.infer<typeof newDealSchema>;
type NewDealField = keyof NewDealFormValues;

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
      "Posez le nom du dossier, l’entreprise cliente et le prix HT à facturer.",
    fields: ["name", "clientCompanyName", "quotePriceHt"],
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
    fields: ["transcript", "additionalContext"],
  },
  {
    eyebrow: "04",
    title: "Consignes de sortie",
    description:
      "Précisez le type de client, les consignes email et les informations de facturation (obligatoire).",
    fields: ["quoteClientType", "quoteTaxRate", "emailInstructions", "clientCompanyInfo"],
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

function toTaxRatePayload(value: string) {
  return Number(value);
}

function getPreviewValue(value: string | undefined, fallback: string) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : fallback;
}

type ExistingTranscript = { id: string; title: string; createdAt: string };

export function NewDealForm({
  existingTranscripts = [],
  defaultQuoteClientType = "company",
  defaultQuoteTaxRate = 20,
}: {
  existingTranscripts?: ExistingTranscript[];
  defaultQuoteClientType?: string;
  defaultQuoteTaxRate?: number;
}) {
  const defaultValues = React.useMemo<NewDealFormValues>(
    () => ({
      name: "",
      clientCompanyName: "",
      quotePriceHt: "",
      expectedCloseDate: "",
      clientContactName: "",
      clientEmail: "",
      phone: "",
      transcript: "",
      additionalContext: "",
      emailInstructions: "",
      quoteClientType: defaultQuoteClientType as "company" | "individual",
      quoteTaxRate: String(defaultQuoteTaxRate),
      clientCompanyInfo: "",
    }),
    [defaultQuoteClientType, defaultQuoteTaxRate],
  );

  const router = useRouter();
  const { language } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isImportingCompanyInfo, setIsImportingCompanyInfo] =
    React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [direction, setDirection] = React.useState(1);
  const [isLastStepReady, setIsLastStepReady] = React.useState(false);
  const [askExpectedCloseDate, setAskExpectedCloseDate] = React.useState(false);
  const [selectedTranscriptId, setSelectedTranscriptId] =
    React.useState<string>("");
  const [transcriptSourceMode, setTranscriptSourceMode] = React.useState<
    "paste" | "audio" | "recall"
  >("paste");
  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const [meetingUrl, setMeetingUrl] = React.useState("");
  const [recallLanguage, setRecallLanguage] = React.useState("fr");
  const audioFileInputRef = React.useRef<HTMLInputElement>(null);
  const form = useForm<NewDealFormValues>({
    resolver: zodResolver(newDealSchema),
    defaultValues,
    mode: "onTouched",
  });
  const copy =
    language === "es"
      ? {
          guided: "Creación guiada",
          newDeal: "Nuevo expediente",
          unnamedDeal: "Expediente por nombrar",
          clientMissing: "Cliente por precisar",
          stepOf: `Paso ${stepIndex + 1} de ${onboardingSteps.length}`,
          dealTitle: "Título del expediente",
          dealPlaceholder: "Respuesta a licitación — sede regional",
          dealHelp: "Un nombre concreto que todo el equipo pueda entender.",
          clientCompany: "Empresa cliente",
          clientPlaceholder: "Estudio, promotora, departamento...",
          budget: "Presupuesto estimado",
          budgetHelp:
            "Opcional, solo si el cliente ha compartido un presupuesto.",
          quotePrice: "Precio sin IVA a facturar",
          quotePriceHelp:
            "Importe sin IVA del presupuesto. Es la fuente de verdad para la facturación.",
          clientType: "Tipo de cliente para el presupuesto",
          clientTypeCompany: "Empresa",
          clientTypeIndividual: "Particular",
          taxRate: "Tasa de IVA del presupuesto",
          taxRateHelp:
            "Tasa de IVA aplicable al presupuesto. El valor por defecto se toma de la configuración de la organización.",
          closeDate: "Fecha objetivo",
          closeDateHelp:
            "Opcional, útil si el expediente debe estar listo antes de una fecha concreta.",
          contactName: "Contacto principal",
          workEmail: "Email profesional",
          phone: "Teléfono",
          phoneHelp: "Opcional, conservado en el contexto del expediente.",
          transcript: "Transcripción o notas de llamada",
          transcriptPlaceholder:
            "Pega aquí notas de descubrimiento, objetivos, restricciones, objeciones, plazos, criterios de decisión y próximos pasos...",
          transcriptHelp:
            "Cuanto más precisas sean las notas, más útiles serán el resumen de llamada y la propuesta comercial.",
          context: "Contexto adicional",
          contextPlaceholder:
            "Referencias a priorizar, puntos sensibles, restricciones políticas, ángulo comercial...",
          emailInstructions: "Instrucciones para el email",
          emailPlaceholder:
            "Tono del mensaje, puntos que mencionar, próxima etapa propuesta...",
          companyInfo: "Información de empresa para el presupuesto",
          importing: "Importando…",
          importPappers: "Importar desde Pappers",
          searchPappers: "Buscar en Pappers",
          companyInfoPlaceholder:
            "Razón social, dirección, identificador de empresa, IVA, email de facturación...",
          companyInfoHelp:
            "Pega aquí la información útil para el presupuesto: razón social, dirección, identificador de empresa, IVA, email de facturación, etc.",
          companyBillingLabel: "Información de empresa para el presupuesto",
          companyBillingPlaceholder:
            "Razón social, dirección, identificador de empresa, IVA, email de facturación...",
          companyBillingHelp:
            "Pega aquí la información útil para el presupuesto: razón social, dirección, identificador de empresa, IVA, email de facturación, etc.",
          individualBillingLabel: "Información de facturación del particular",
          individualBillingPlaceholder:
            "Dirección de facturación, código postal, ciudad, país, email de facturación si diferente...",
          individualBillingHelp:
            "Pega aquí la información útil para el presupuesto del particular: dirección de facturación, código postal, ciudad, país, email de facturación si diferente del contacto.",
          deal: "Expediente",
          client: "Cliente",
          contact: "Contacto",
          missing: "Por completar",
          previous: "Anterior",
          completed: `${Math.round(((stepIndex + 1) / onboardingSteps.length) * 100)}% completado`,
          creating: "Creando...",
          create: "Crear expediente",
          next: "Siguiente",
        }
      : language === "en"
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
          quotePrice: "Excl. tax price to invoice",
          quotePriceHelp:
            "Excl. tax amount for the quote. This is the source of truth for billing.",
          clientType: "Client type for the quote",
          clientTypeCompany: "Company",
          clientTypeIndividual: "Individual",
          taxRate: "Quote VAT rate",
          taxRateHelp:
            "VAT rate applicable to the quote. Default value is taken from organization settings.",
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
          companyBillingLabel: "Company information for the quote",
          companyBillingPlaceholder:
            "Legal name, address, company ID, VAT number, billing email...",
          companyBillingHelp:
            "Paste useful quote information here: legal name, address, company ID, VAT number, billing email, etc.",
          individualBillingLabel: "Individual billing information",
          individualBillingPlaceholder:
            "Billing address, postal code, city, country, billing email if different...",
          individualBillingHelp:
            "Paste useful quote information for the individual: billing address, postal code, city, country, billing email if different from contact.",
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
          quotePrice: "Prix HT à facturer",
          quotePriceHelp:
            "Montant HT du devis. C'est la source de vérité pour la facturation.",
          clientType: "Type de client pour le devis",
          clientTypeCompany: "Entreprise",
          clientTypeIndividual: "Particulier",
          taxRate: "Taux de TVA du devis",
          taxRateHelp:
            "Taux de TVA applicable au devis. La valeur par défaut provient des paramètres de l'organisation.",
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
          companyBillingLabel: "Informations société pour le devis",
          companyBillingPlaceholder:
            "Raison sociale, adresse, SIRET/SIREN, TVA intracommunautaire, email de facturation...",
          companyBillingHelp:
            "Collez ici les informations utiles pour le devis : raison sociale, adresse, SIRET/SIREN, TVA intracommunautaire, email de facturation, etc.",
          individualBillingLabel: "Informations de facturation du particulier",
          individualBillingPlaceholder:
            "Adresse de facturation, code postal, ville, pays, email de facturation si différent...",
          individualBillingHelp:
            "Collez ici les informations utiles pour le devis du particulier : adresse de facturation, code postal, ville, pays, et email de facturation si différent du contact.",
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
    language === "es"
      ? [
          {
            title: "Marco del expediente",
            description:
              "Define el nombre del expediente, la empresa cliente y el precio sin IVA a facturar.",
          },
          {
            title: "Contacto cliente",
            description:
              "Identifica a la persona que recibirá los intercambios y documentos.",
          },
          {
            title: "Notas de llamada",
            description:
              "Añade la materia prima: transcripción, briefing, restricciones, expectativas del cliente y contexto adicional.",
          },
          {
            title: "Instrucciones de salida",
            description:
              "Precisa el tipo de cliente, las instrucciones de email y la información de facturación (obligatorio).",
          },
        ]
      : language === "en"
        ? [
            {
              title: "Deal frame",
              description:
                "Set the deal name, client company, and the excl. tax price to invoice.",
            },
            {
              title: "Client contact",
              description:
                "Identify the person who will receive exchanges and documents.",
            },
            {
              title: "Call notes",
              description:
                "Add the raw material: transcript, brief, constraints, client expectations, and additional context.",
            },
            {
              title: "Output instructions",
              description:
                "Specify the client type, email instructions, and billing information (required).",
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
    if (stepIndex === 2) {
      if (transcriptSourceMode === "paste") {
        const text = form.getValues("transcript")?.trim() ?? "";
        if (text.length < 20) {
          form.setError("transcript", {
            message: getLocalizedCopy(language, {
              fr: "Ajoutez au moins quelques notes d'échange.",
              en: "Add at least a few exchange notes.",
              es: "Añade al menos algunas notas del intercambio.",
            }),
          });
          return;
        }
      } else if (transcriptSourceMode === "audio") {
        if (!audioFile) {
          toast.error(
            getLocalizedCopy(language, {
              fr: "Sélectionnez un fichier audio.",
              en: "Select an audio file.",
              es: "Selecciona un archivo de audio.",
            }),
          );
          return;
        }
      } else if (transcriptSourceMode === "recall") {
        const meetingUrlRegex =
          /^https:\/\/([a-z0-9-]+\.)?(meet\.google\.com\/|zoom\.us\/(j|wc\/join)\/|teams\.(microsoft|live)\.com\/l\/(meetup-join|meet)\/)/;
        if (!meetingUrlRegex.test(meetingUrl.trim())) {
          toast.error(
            getLocalizedCopy(language, {
              fr: "Entrez un lien de réunion valide (Google Meet, Zoom ou Teams).",
              en: "Enter a valid meeting URL (Google Meet, Zoom, or Teams).",
              es: "Introduce un enlace de reunión válido (Google Meet, Zoom o Teams).",
            }),
          );
          return;
        }
      }
      setDirection(1);
      setStepIndex((current) =>
        Math.min(current + 1, onboardingSteps.length - 1),
      );
      return;
    }

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

    const quotePriceHt = toAmountPayload(valuesToSubmit.quotePriceHt);
    const quoteTaxRate = toTaxRatePayload(valuesToSubmit.quoteTaxRate);
    const response = await fetch("/api/deals", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...valuesToSubmit,
        transcriptSource: transcriptSourceMode,
        transcript:
          transcriptSourceMode === "paste"
            ? valuesToSubmit.transcript?.trim()
            : null,
        quotePriceHt,
        quoteTaxRate,
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
        description:
          "Le dossier a été créé, mais son identifiant est manquant.",
      });
      return;
    }

    if (transcriptSourceMode === "audio" && audioFile) {
      const formData = new FormData();
      formData.append("file", audioFile);
      formData.append("title", `${valuesToSubmit.name} — Audio`);
      formData.append("dealId", dealId);

      const uploadRes = await fetch("/api/transcripts/upload", {
        method: "POST",
        body: formData,
      }).catch(() => null);

      if (!uploadRes?.ok) {
        toast.warning(
          getLocalizedCopy(language, {
            fr: "Dossier créé mais l'upload audio a échoué. Vous pouvez réessayer depuis le dossier.",
            en: "Deal created but audio upload failed. You can retry from the deal page.",
            es: "Expediente creado, pero la subida del audio ha fallado. Puedes reintentarlo desde el expediente.",
          }),
        );
      }
    }

    if (transcriptSourceMode === "recall" && meetingUrl.trim()) {
      const recallRes = await fetch("/api/transcripts/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${valuesToSubmit.name} — Réunion`,
          meetingUrl: meetingUrl.trim(),
          dealId,
          language: recallLanguage !== "auto" ? recallLanguage : null,
        }),
      }).catch(() => null);

      if (!recallRes?.ok) {
        toast.warning(
          getLocalizedCopy(language, {
            fr: "Dossier créé mais le bot d'enregistrement n'a pas pu démarrer. Vous pouvez réessayer depuis Transcripts.",
            en: "Deal created but recording bot could not be started. You can retry from Transcripts.",
            es: "Expediente creado, pero no se ha podido iniciar la grabación. Puedes reintentarlo desde Transcripciones.",
          }),
        );
      }
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
        <section className="dark:bg-card/90 overflow-hidden border bg-[#f1eadf] shadow-[0_24px_70px_-48px_rgba(22,31,48,0.62)]">
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
                  {getPreviewValue(
                    values.clientCompanyName,
                    copy.clientMissing,
                  )}
                </p>
              </div>
            </aside>

            <div className="bg-card/92 flex min-h-[32rem] flex-col">
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
                              <FormDescription>{copy.dealHelp}</FormDescription>
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
                          name="quotePriceHt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{copy.budget}</FormLabel>
                              <FormControl>
                                <Input
                                  inputMode="decimal"
                                  placeholder="1 500"
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
                              {getLocalizedCopy(language, {
                                fr: "Utiliser un transcript existant",
                                en: "Use an existing transcript",
                                es: "Usar una transcripción existente",
                              })}
                            </label>
                            <Select
                              value={selectedTranscriptId}
                              onValueChange={(value) => {
                                setSelectedTranscriptId(value);
                                if (value && value !== "none") {
                                  setTranscriptSourceMode("paste");
                                  fetch(`/api/transcripts/${value}`)
                                    .then((r) => r.json())
                                    .then((data: unknown) => {
                                      if (
                                        data &&
                                        typeof data === "object" &&
                                        "transcriptText" in data &&
                                        typeof (
                                          data as { transcriptText: unknown }
                                        ).transcriptText === "string"
                                      ) {
                                        form.setValue(
                                          "transcript",
                                          (data as { transcriptText: string })
                                            .transcriptText,
                                          {
                                            shouldDirty: true,
                                            shouldTouch: true,
                                            shouldValidate: true,
                                          },
                                        );
                                      }
                                    })
                                    .catch(() => {});
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={getLocalizedCopy(language, {
                                    fr: "Sélectionner un transcript...",
                                    en: "Select a transcript...",
                                    es: "Seleccionar una transcripción...",
                                  })}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  {getLocalizedCopy(language, {
                                    fr: "Aucun — coller manuellement",
                                    en: "None — paste manually",
                                    es: "Ninguna — pegar manualmente",
                                  })}
                                </SelectItem>
                                {existingTranscripts.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {selectedTranscriptId &&
                              selectedTranscriptId !== "none" && (
                                <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  <MessageSquareText className="size-3.5" />
                                  {getLocalizedCopy(language, {
                                    fr: "Transcript lié — contenu importé ci-dessous",
                                    en: "Transcript linked — content imported below",
                                    es: "Transcripción asociada — contenido importado abajo",
                                  })}
                                </div>
                              )}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setTranscriptSourceMode("paste")}
                            className={cn(
                              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                              transcriptSourceMode === "paste"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border text-muted-foreground hover:bg-muted/50",
                            )}
                          >
                            <FileText className="size-4" />
                            {getLocalizedCopy(language, {
                              fr: "Coller le texte",
                              en: "Paste text",
                              es: "Pegar texto",
                            })}
                          </button>
                          <button
                            type="button"
                            onClick={() => setTranscriptSourceMode("audio")}
                            className={cn(
                              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                              transcriptSourceMode === "audio"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border text-muted-foreground hover:bg-muted/50",
                            )}
                          >
                            <Mic className="size-4" />
                            {getLocalizedCopy(language, {
                              fr: "Téléverser un audio",
                              en: "Upload audio",
                              es: "Subir audio",
                            })}
                          </button>
                          <button
                            type="button"
                            onClick={() => setTranscriptSourceMode("recall")}
                            className={cn(
                              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                              transcriptSourceMode === "recall"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border text-muted-foreground hover:bg-muted/50",
                            )}
                          >
                            <Radio className="size-4" />
                            {getLocalizedCopy(language, {
                              fr: "Enregistrer une réunion",
                              en: "Record a meeting",
                              es: "Grabar una reunión",
                            })}
                          </button>
                        </div>

                        {transcriptSourceMode === "paste" && (
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
                        )}

                        {transcriptSourceMode === "audio" && (
                          <div className="space-y-3">
                            {!audioFile ? (
                              <label
                                htmlFor="deal-audio-file-input"
                                className="hover:border-primary/50 hover:bg-muted/30 flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 transition-colors"
                              >
                                <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                                  <Upload className="text-muted-foreground size-5" />
                                </div>
                                <div className="text-center">
                                  <p className="text-sm font-medium">
                                    {getLocalizedCopy(language, {
                                      fr: "Cliquez ou déposez un fichier audio ici",
                                      en: "Click or drag an audio file here",
                                      es: "Haz clic o arrastra un archivo de audio aquí",
                                    })}
                                  </p>
                                  <p className="text-muted-foreground mt-1 text-xs">
                                    {getLocalizedCopy(language, {
                                      fr: "Formats acceptés : MP3, WAV, M4A, WebM — max 100 Mo",
                                      en: "Accepted: MP3, WAV, M4A, WebM — max 100 MB",
                                      es: "Formatos aceptados: MP3, WAV, M4A, WebM — máx. 100 MB",
                                    })}
                                  </p>
                                </div>
                                <input
                                  ref={audioFileInputRef}
                                  id="deal-audio-file-input"
                                  type="file"
                                  accept=".mp3,.wav,.m4a,.webm"
                                  className="sr-only"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    if (file.size > 100 * 1024 * 1024) {
                                      toast.error(
                                        getLocalizedCopy(language, {
                                          fr: "Le fichier dépasse la limite de 100 Mo.",
                                          en: "File exceeds 100 MB limit.",
                                          es: "El archivo supera el límite de 100 MB.",
                                        }),
                                      );
                                      return;
                                    }
                                    setAudioFile(file);
                                  }}
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
                                      {audioFile.size < 1024 * 1024
                                        ? `${(audioFile.size / 1024).toFixed(0)} Ko`
                                        : `${(audioFile.size / (1024 * 1024)).toFixed(1)} Mo`}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setAudioFile(null);
                                      if (audioFileInputRef.current)
                                        audioFileInputRef.current.value = "";
                                    }}
                                    className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                                  >
                                    <X className="size-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            <p className="text-muted-foreground text-xs">
                              {getLocalizedCopy(language, {
                                fr: "L'audio sera transcrit automatiquement après la création du dossier.",
                                en: "The audio will be transcribed automatically after the deal is created.",
                                es: "El audio se transcribirá automáticamente después de crear el expediente.",
                              })}
                            </p>
                          </div>
                        )}

                        {transcriptSourceMode === "recall" && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 rounded-md border border-blue-100 bg-blue-50/50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/30">
                              <Radio className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
                              <p className="text-sm text-blue-800 dark:text-blue-200">
                                {getLocalizedCopy(language, {
                                  fr: "Un bot d'enregistrement rejoindra votre réunion et transcrira l'appel automatiquement.",
                                  en: "A recording bot will join your meeting and transcribe the call automatically.",
                                  es: "La reunión se grabará y la llamada se transcribirá automáticamente.",
                                })}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <label
                                htmlFor="deal-meeting-url"
                                className="text-sm font-medium"
                              >
                                {getLocalizedCopy(language, {
                                  fr: "Lien de réunion",
                                  en: "Meeting URL",
                                  es: "Enlace de reunión",
                                })}
                              </label>
                              <Input
                                id="deal-meeting-url"
                                type="url"
                                placeholder="https://meet.google.com/abc-defg-hij"
                                value={meetingUrl}
                                onChange={(e) => setMeetingUrl(e.target.value)}
                              />
                              <p className="text-muted-foreground text-xs">
                                {getLocalizedCopy(language, {
                                  fr: "Liens Google Meet, Zoom ou Microsoft Teams acceptés.",
                                  en: "Google Meet, Zoom, or Microsoft Teams links are supported.",
                                  es: "Se admiten enlaces de Google Meet, Zoom o Microsoft Teams.",
                                })}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <label
                                htmlFor="deal-recall-language"
                                className="text-sm font-medium"
                              >
                                {getLocalizedCopy(language, {
                                  fr: "Langue du transcript",
                                  en: "Transcript language",
                                  es: "Idioma de la transcripción",
                                })}
                              </label>
                              <Select
                                value={recallLanguage}
                                onValueChange={setRecallLanguage}
                              >
                                <SelectTrigger id="deal-recall-language">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto">
                                    {getLocalizedCopy(language, {
                                      fr: "Détection automatique",
                                      en: "Auto-detect",
                                      es: "Detección automática",
                                    })}
                                  </SelectItem>
                                  <SelectItem value="fr">
                                    {getLocalizedCopy(language, {
                                      fr: "Français",
                                      en: "French",
                                      es: "Francés",
                                    })}
                                  </SelectItem>
                                  <SelectItem value="en">
                                    {getLocalizedCopy(language, {
                                      fr: "Anglais",
                                      en: "English",
                                      es: "Inglés",
                                    })}
                                  </SelectItem>
                                  <SelectItem value="es">
                                    {getLocalizedCopy(language, {
                                      fr: "Espagnol",
                                      en: "Spanish",
                                      es: "Español",
                                    })}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-muted-foreground text-xs">
                                {getLocalizedCopy(language, {
                                  fr: "Sélectionnez la langue parlée pour améliorer la qualité de la transcription.",
                                  en: "Select the spoken language to improve transcription quality.",
                                  es: "Selecciona el idioma hablado para mejorar la calidad de la transcripción.",
                                })}
                              </p>
                            </div>
                          </div>
                        )}

                        <FormField
                          control={form.control}
                          name="additionalContext"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{copy.context}</FormLabel>
                              <FormControl>
                                <Textarea
                                  rows={4}
                                  placeholder={copy.contextPlaceholder}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : null}

                    {stepIndex === 3 ? (
                      <div className="space-y-5">
                        <div className="grid gap-5 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="quoteClientType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{copy.clientType}</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="company">
                                      {copy.clientTypeCompany}
                                    </SelectItem>
                                    <SelectItem value="individual">
                                      {copy.clientTypeIndividual}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="quoteTaxRate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{copy.taxRate}</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="0">0 %</SelectItem>
                                    <SelectItem value="5.5">5,5 %</SelectItem>
                                    <SelectItem value="10">10 %</SelectItem>
                                    <SelectItem value="20">20 %</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  {copy.taxRateHelp}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
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
                                  {values.quoteClientType === "individual"
                                    ? copy.individualBillingLabel
                                    : copy.companyBillingLabel}
                                </FormLabel>
                                {values.quoteClientType !== "individual" ? (
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
                                ) : null}
                                {values.quoteClientType !== "individual" ? (
                                  <Button asChild variant="outline" size="sm">
                                    <a
                                      href="https://www.pappers.fr/"
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {copy.searchPappers}
                                      <ExternalLink aria-hidden="true" />
                                    </a>
                                  </Button>
                                ) : null}
                              </div>
                              <FormControl>
                                <Textarea
                                  rows={4}
                                  placeholder={
                                    values.quoteClientType === "individual"
                                      ? copy.individualBillingPlaceholder
                                      : copy.companyBillingPlaceholder
                                  }
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {values.quoteClientType === "individual"
                                  ? copy.individualBillingHelp
                                  : copy.companyBillingHelp}
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

              <div className="bg-muted/35 flex flex-col-reverse gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
