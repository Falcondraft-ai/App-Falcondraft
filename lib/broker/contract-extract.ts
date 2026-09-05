// Automatic reading of a contract document (police, conditions particulières,
// attestation) → structured fields that pre-fill the contract. Same approach and
// model as the quote extractor. The broker always reviews what was read: nothing
// here is authoritative until they validate it on the contract page.
import { logOpenAiUsage, type OpenAiUsage } from "@/lib/ai/usage";
import { reasoningParams } from "@/lib/ai/model";

import { brokerInsuranceTypes } from "@/lib/broker/clients";
import {
  brokerPremiumFrequencies,
  type BrokerPremiumFrequency,
} from "@/lib/broker/contracts";
import type { BrokerInsuranceType } from "@/lib/broker/clients";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const EXTRACT_MODEL = process.env.COURTIER_EXTRACT_MODEL || "gpt-5.5";

export type ContractExtraction = {
  insurer_name: string | null;
  product_name: string | null;
  insurance_type: BrokerInsuranceType | null;
  policy_number: string | null;
  effective_date: string | null;
  renewal_date: string | null;
  premium_amount: number | null;
  premium_frequency: BrokerPremiumFrequency | null;
  currency: string | null;
  tacit_renewal: boolean | null;
  notes: string | null;
};

export type ContractExtractionResult =
  | { ok: true; data: ContractExtraction }
  | { ok: false; reason: string; message: string };

function num(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Keeps a date only in strict ISO day form — never a guessed or partial one. */
function isoDate(value: unknown): string | null {
  const raw = str(value, 10);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === raw ? raw : null;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  const raw = str(value, 40)?.toLowerCase();
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

/**
 * Reads a contract document and returns the fields of the policy it describes.
 * Never invents: anything not written in the document comes back null.
 */
export async function extractContract(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<ContractExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason: "ai_unconfigured",
      message: "La lecture n'est pas activée (OPENAI_API_KEY manquant).",
    };
  }

  const name = input.fileName.toLowerCase();
  const mime = input.mimeType.toLowerCase();
  const isPdf = mime.includes("pdf") || name.endsWith(".pdf");
  const isImage =
    mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|tiff?)$/.test(name);
  if (!isPdf && !isImage) {
    return {
      ok: false,
      reason: "unsupported_format",
      message: "La lecture automatique ne traite que les PDF ou images.",
    };
  }

  const b64 = input.buffer.toString("base64");
  const schema =
    '{"insurer_name": string|null, "product_name": string|null, "insurance_type": string|null, "policy_number": string|null, "effective_date": string|null, "renewal_date": string|null, "premium_amount": number|null, "premium_frequency": string|null, "currency": string|null, "tacit_renewal": boolean|null, "notes": string|null}';
  const instruction =
    `Lis ce document de contrat d'assurance (police, conditions particulières, avenant ou attestation) et extrais ses informations au format JSON strict suivant :\n${schema}\n` +
    "Règles :\n" +
    "- N'invente JAMAIS une donnée ; mets null si l'information est absente du document.\n" +
    "- insurer_name : la compagnie d'assurance. product_name : le nom commercial du contrat/formule.\n" +
    `- insurance_type : une seule valeur parmi ${brokerInsuranceTypes.join(", ")} (immobilier = habitation/MRH ; personnes = santé, prévoyance, emprunteur ; auto = véhicules ; pro = professionnels/entreprise).\n` +
    "- policy_number : le numéro de police / contrat tel qu'écrit.\n" +
    "- effective_date : date d'effet. renewal_date : date d'échéance principale / de renouvellement. Format STRICT AAAA-MM-JJ, sinon null.\n" +
    "- premium_amount : la cotisation, en nombre (point décimal, sans symbole ni texte).\n" +
    `- premium_frequency : une seule valeur parmi ${brokerPremiumFrequencies.join(", ")} (monthly = mensuelle, quarterly = trimestrielle, biannual = semestrielle, annual = annuelle, single = prime unique), correspondant au montant de premium_amount.\n` +
    "- currency : code ISO (EUR par défaut).\n" +
    "- tacit_renewal : true si la reconduction tacite est mentionnée, false si elle est explicitement exclue, null si le document n'en parle pas.\n" +
    "- notes : résumé court et factuel des garanties principales et des points à retenir (franchises, exclusions notables).";

  const userContent: unknown[] = isPdf
    ? [
        { type: "text", text: instruction },
        {
          type: "file",
          file: {
            filename: input.fileName || "contrat.pdf",
            file_data: `data:application/pdf;base64,${b64}`,
          },
        },
      ]
    : [
        { type: "text", text: instruction },
        {
          type: "image_url",
          image_url: {
            url: `data:${mime.startsWith("image/") ? mime : "image/png"};base64,${b64}`,
          },
        },
      ];

  let res: Response | null;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        ...reasoningParams(EXTRACT_MODEL, "low"),
        response_format: { type: "json_object" },
        max_completion_tokens: 2500,
        messages: [
          {
            role: "system",
            content:
              "Tu extrais des informations de contrats d'assurance en JSON strict. Tu n'inventes jamais de donnée ; si une information est absente, tu mets null.",
          },
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch {
    res = null;
  }

  if (!res || !res.ok) {
    return {
      ok: false,
      reason: "ai_failed",
      message:
        "La lecture du contrat n'a pas abouti. Complétez les informations manuellement.",
    };
  }

  const payload = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    usage?: OpenAiUsage;
  } | null;
  logOpenAiUsage("contract_extract", EXTRACT_MODEL, payload?.usage);
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    return {
      ok: false,
      reason: "empty",
      message: "Le contrat n'a pas pu être lu. Complétez-le manuellement.",
    };
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      reason: "parse_failed",
      message: "Réponse illisible. Complétez les informations manuellement.",
    };
  }

  return {
    ok: true,
    data: {
      insurer_name: str(raw.insurer_name, 160),
      product_name: str(raw.product_name, 200),
      insurance_type: oneOf(raw.insurance_type, brokerInsuranceTypes),
      policy_number: str(raw.policy_number, 120),
      effective_date: isoDate(raw.effective_date),
      renewal_date: isoDate(raw.renewal_date),
      premium_amount: num(raw.premium_amount),
      premium_frequency: oneOf(raw.premium_frequency, brokerPremiumFrequencies),
      currency: str(raw.currency, 8),
      tacit_renewal: bool(raw.tacit_renewal),
      notes: str(raw.notes, 5000),
    },
  };
}
