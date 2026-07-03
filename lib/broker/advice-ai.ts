import Anthropic from "@anthropic-ai/sdk";
import { insuranceTypeLabel } from "@/lib/broker/clients";
import { summarizeStructuredNeeds } from "@/lib/broker/needs";
import { formatPremium } from "@/lib/broker/quotes";
import type { BrokerClientRow, BrokerQuoteRow } from "@/types/database";

// The devoir de conseil is a legal document → quality over cost: Claude Opus 4.8
// (deliberate exception to the module's OpenAI default). Override via env.
const ADVICE_MODEL = process.env.COURTIER_ADVICE_MODEL || "claude-opus-4-8";

export type AdviceContentResult =
  | { success: true; requirements: string; motifs: string }
  | { success: false; reason: string; message: string };

/** Splits the model output into its "EXIGENCES:" and "MOTIFS:" bullet blocks. */
function splitRequirementsAndMotifs(raw: string): {
  requirements: string;
  motifs: string;
} {
  const lines = raw
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const motifsIdx = lines.findIndex((l) => /^motifs\s*:?/i.test(l));
  const bulletize = (arr: string[]) =>
    arr
      .filter((l) => !/^(exigences|motifs)\s*:?/i.test(l))
      .map((l) => (/^[-•]/.test(l) ? l.replace(/^•/, "-") : `- ${l}`))
      .join("\n");
  if (motifsIdx === -1) {
    // No explicit split → treat everything as motifs (backward-compatible).
    return { requirements: "", motifs: bulletize(lines) };
  }
  return {
    requirements: bulletize(lines.slice(0, motifsIdx)),
    motifs: bulletize(lines.slice(motifsIdx)),
  };
}

function quoteCotisation(quote: BrokerQuoteRow): string | null {
  if (quote.premium_monthly != null) {
    return `${formatPremium(quote.premium_monthly, quote.currency)} / mois`;
  }
  if (quote.premium_annual != null) {
    return `${formatPremium(quote.premium_annual, quote.currency)} / an`;
  }
  return null;
}

/**
 * Generates, with Claude Opus 4.8, both sections a devoir de conseil needs:
 *  - "exigences en termes de garantie" — the client's coverage requirements,
 *    formalised FROM the quote's guarantees (what the contract must cover);
 *  - "motifs" — why the proposed contract meets those requirements.
 * Strictly grounded in the client's recorded needs and the chosen quote; the
 * model never invents. Output is a draft, always reviewed before validation.
 */
export async function generateAdviceContent(
  client: BrokerClientRow,
  quote: BrokerQuoteRow | null,
): Promise<AdviceContentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      reason: "ai_unconfigured",
      message: "L'assistant IA n'est pas activé (ANTHROPIC_API_KEY manquant).",
    };
  }
  if (!quote) {
    return {
      success: false,
      reason: "no_quote",
      message: "Validez un devis compagnie pour générer les motifs.",
    };
  }

  const branch = insuranceTypeLabel(client.insurance_type);
  const facts = {
    branche: branch !== "—" ? branch : null,
    besoins_exprimes_par_le_client:
      client.notes?.trim() || client.needs?.trim() || null,
    elements_recueillis: summarizeStructuredNeeds(
      client.insurance_type,
      client.structured_needs,
    ),
    contrat_propose: {
      compagnie: quote.insurer_name,
      produit: quote.product_name,
      cotisation: quoteCotisation(quote),
      garanties_principales: quote.coverage_summary,
      franchise: quote.deductible,
      exclusions_points_vigilance: quote.vigilance_points,
      autres_informations: quote.other_info,
    },
  };

  const system = [
    "Tu rédiges deux rubriques d'un devoir de conseil d'assurance français (IARD).",
    "1) EXIGENCES EN TERMES DE GARANTIE : formalise, à partir des GARANTIES du contrat proposé (contrat_propose.garanties_principales) et des besoins du client, les exigences de couverture du client — c.-à-d. ce que le contrat doit couvrir (ex. responsabilité civile, dommages, vol, assistance, protection juridique…). Reformule-les comme des exigences du client, pas comme une simple recopie du devis.",
    "2) MOTIFS : explique en quoi le contrat proposé répond à ces exigences.",
    "FORMAT DE SORTIE EXACT (rien d'autre) :",
    "EXIGENCES:",
    "- …",
    "- …",
    "MOTIFS:",
    "- …",
    "- …",
    "RÈGLES STRICTES :",
    "- 2 à 5 puces par rubrique, chacune commençant par « - ».",
    "- Utilise UNIQUEMENT les faits fournis. N'invente JAMAIS une garantie, un montant, une franchise, une option ou une donnée absente.",
    "- Si une information manque, ne la mentionne pas et ne comble aucun vide.",
    "- Style sobre, factuel et professionnel ; aucun superlatif commercial.",
    "- N'écris ni introduction, ni conclusion, ni raisonnement : seulement les deux en-têtes et leurs puces.",
  ].join("\n");

  const user = `Faits disponibles (ne rien ajouter au-delà) :\n${JSON.stringify(facts, null, 2)}`;

  let message: Anthropic.Message;
  try {
    const anthropic = new Anthropic({ apiKey });
    message = await anthropic.messages.create({
      model: ADVICE_MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    });
  } catch (error) {
    console.error("[broker] advice motifs (Claude) failed:", error);
    return {
      success: false,
      reason: "api_error",
      message: "La génération IA n'a pas abouti. Réessayez.",
    };
  }

  if (message.stop_reason === "refusal") {
    return {
      success: false,
      reason: "refusal",
      message: "La génération IA n'a pas abouti. Réessayez.",
    };
  }

  let raw = "";
  for (const block of message.content) {
    if (block.type === "text") raw += block.text;
  }
  if (!raw.trim()) {
    return {
      success: false,
      reason: "empty",
      message: "L'IA n'a pas renvoyé de motifs. Réessayez.",
    };
  }

  const { requirements, motifs } = splitRequirementsAndMotifs(raw);
  return { success: true, requirements, motifs };
}
