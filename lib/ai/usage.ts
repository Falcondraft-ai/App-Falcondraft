import "server-only";

/**
 * Instrumentation du coût IA.
 *
 * Tous les appels du produit partaient sur le même modèle, sans jamais relever
 * `usage` : le tableau de bord du fournisseur ne pouvait donc pas dire si une
 * journée chère venait du briefing email, du copilote ou de la lecture de
 * pièces jointes. Chaque appel journalise désormais ses jetons sous une
 * étiquette de fonctionnalité, ce qui rend la facture attribuable.
 *
 * On ne journalise QUE des compteurs et des identifiants internes — jamais un
 * contenu d'email, de document ou de dossier (cf. règles PostHog/monitoring).
 */

/** Fonctionnalité à l'origine de l'appel — l'axe d'attribution de la facture. */
export type AiFeature =
  | "digest_classify"
  | "digest_narrative"
  | "document_understanding"
  | "quote_extract"
  | "contract_extract"
  | "commission_extract"
  | "import_classify"
  | "courtier_agent"
  | "advice_motifs"
  | "transcript_cleanup";

/** Forme du bloc `usage` renvoyé par l'API Chat Completions. */
export type OpenAiUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
};

/** Contexte d'attribution — identifiants internes uniquement. */
export type AiUsageMeta = {
  organizationId?: string | null;
  /** Ex. nombre d'emails du lot, pages de PDF envoyées : le coût unitaire. */
  units?: number;
  [key: string]: unknown;
};

function emit(record: Record<string, unknown>) {
  // Une seule ligne, préfixe stable : greppable dans les logs Vercel et
  // agrégeable sans outil dédié (`[ai-usage]`).
  console.log(`[ai-usage] ${JSON.stringify(record)}`);
}

/**
 * Journalise l'usage d'un appel OpenAI. `cached` est le nerf de la guerre :
 * c'est lui qui dit si le cache de prompt fonctionne réellement.
 */
export function logOpenAiUsage(
  feature: AiFeature,
  model: string,
  usage: OpenAiUsage | null | undefined,
  meta?: AiUsageMeta,
): void {
  if (!usage) {
    // Un appel sans usage est un angle mort : on le dit plutôt que de le taire.
    emit({ feature, model, usage: "missing", ...meta });
    return;
  }
  const input = usage.prompt_tokens ?? 0;
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
  emit({
    feature,
    model,
    in: input,
    cached,
    // Part de l'entrée facturée au tarif réduit : l'indicateur à surveiller
    // quand on touche à l'ordre des blocs d'un prompt.
    cache_hit: input > 0 ? Math.round((cached / input) * 100) : 0,
    out: usage.completion_tokens ?? 0,
    reasoning: usage.completion_tokens_details?.reasoning_tokens ?? 0,
    ...meta,
  });
}

/** Même journal pour les appels Anthropic (devoir de conseil). */
export function logAnthropicUsage(
  feature: AiFeature,
  model: string,
  usage:
    | {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number | null;
      }
    | null
    | undefined,
  meta?: AiUsageMeta,
): void {
  if (!usage) {
    emit({ feature, model, usage: "missing", ...meta });
    return;
  }
  emit({
    feature,
    model,
    in: usage.input_tokens ?? 0,
    cached: usage.cache_read_input_tokens ?? 0,
    out: usage.output_tokens ?? 0,
    ...meta,
  });
}
