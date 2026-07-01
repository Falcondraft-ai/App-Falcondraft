import Anthropic from "@anthropic-ai/sdk";
import { insuranceTypeLabel } from "@/lib/broker/clients";
import { summarizeStructuredNeeds } from "@/lib/broker/needs";
import { formatPremium } from "@/lib/broker/quotes";
import type { BrokerClientRow, BrokerQuoteRow } from "@/types/database";

// The devoir de conseil is a legal document → quality over cost: Claude Opus 4.8
// (deliberate exception to the module's OpenAI default). Override via env.
const ADVICE_MODEL = process.env.COURTIER_ADVICE_MODEL || "claude-opus-4-8";

export type AdviceMotifsResult =
  | { success: true; motifs: string }
  | { success: false; reason: string; message: string };

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
 * Generates the "raisons qui motivent le conseil" bullets for a devoir de
 * conseil with Claude Opus 4.8. Strictly grounded: the model receives only the
 * client's recorded needs and the chosen quote, and is forbidden from inventing
 * any fact. Output is a draft — always reviewed by the broker before validation.
 */
export async function generateAdviceMotifs(
  client: BrokerClientRow,
  quote: BrokerQuoteRow | null,
): Promise<AdviceMotifsResult> {
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
    besoins_exprimes_par_le_client: client.needs?.trim() || null,
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
    "Tu rédiges la rubrique « raisons qui motivent le conseil » d'un devoir de conseil d'assurance français (IARD).",
    "RÈGLES STRICTES :",
    "- Produis 2 à 4 puces maximum, chacune commençant par « - ».",
    "- Chaque puce relie une garantie ou caractéristique du contrat proposé à un besoin réellement exprimé par le client.",
    "- Utilise UNIQUEMENT les faits fournis. N'invente JAMAIS une garantie, un montant, une franchise, une option ou une donnée absente.",
    "- Si une information manque, ne la mentionne pas et ne comble aucun vide.",
    "- Style sobre, factuel et professionnel ; aucun superlatif commercial.",
    "- Réponds uniquement avec les puces, sans introduction, sans conclusion et sans raisonnement.",
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

  // Normalise every non-empty line to a "- " bullet.
  const motifs = raw
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => (/^[-•]/.test(l) ? l.replace(/^•/, "-") : `- ${l}`))
    .join("\n");

  return { success: true, motifs };
}
