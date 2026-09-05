import "server-only";

/**
 * Réglage de l'effort de raisonnement.
 *
 * Sur la famille gpt-5, les jetons de raisonnement sont invisibles mais
 * facturés au tarif de SORTIE, et l'effort par défaut est « medium ». Sur une
 * tâche à schéma JSON strict — classer un email, identifier un document,
 * relever les champs d'un devis — ce raisonnement étendu ne change pas le
 * résultat : il coûte. On le baisse là, et seulement là. Le copilote, qui
 * planifie sur plusieurs tours d'outils, garde l'effort par défaut.
 */
export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

/**
 * Renvoie `{ reasoning_effort }` uniquement si le modèle le comprend.
 *
 * Le modèle vient d'une variable d'environnement : rien n'empêche d'y mettre
 * `gpt-4.1`, qui rejetterait le paramètre et ferait échouer l'appel. La garde
 * évite qu'un réglage de coût casse une fonctionnalité.
 */
export function reasoningParams(
  model: string,
  effort: ReasoningEffort = "low",
): { reasoning_effort?: ReasoningEffort } {
  const m = model.toLowerCase();
  const isReasoningFamily = /^gpt-[5-9]/.test(m) || /^o[1-9]/.test(m);
  // Les variantes « chat » de la famille gpt-5 ne raisonnent pas et refusent
  // le paramètre.
  if (!isReasoningFamily || m.includes("chat")) return {};
  return { reasoning_effort: effort };
}
