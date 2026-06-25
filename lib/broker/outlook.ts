// ---------------------------------------------------------------------------
// Outlook assistant — shared constants for the daily email briefing.
// ---------------------------------------------------------------------------

/** Brokerage-relevant email categories. Non-brokerage mail is excluded upstream. */
export const emailCategories = [
  "prospect",
  "client_request",
  "quote",
  "contract",
  "claim",
  "renewal",
  "invoice",
  "other_broker",
] as const;

export type EmailCategory = (typeof emailCategories)[number];

export const emailCategoryLabels: Record<EmailCategory, string> = {
  prospect: "Nouveau prospect",
  client_request: "Demande client",
  quote: "Devis reçu",
  contract: "Contrat / souscription",
  claim: "Sinistre",
  renewal: "Échéance / renouvellement",
  invoice: "Facture / paiement",
  other_broker: "Autre — courtage",
};

/** Display order for grouping the briefing. */
export const emailCategoryOrder: EmailCategory[] = [
  "claim",
  "renewal",
  "client_request",
  "prospect",
  "quote",
  "contract",
  "invoice",
  "other_broker",
];

export function isEmailCategory(value: string): value is EmailCategory {
  return (emailCategories as readonly string[]).includes(value);
}

export function emailCategoryLabel(value: string | null | undefined): string {
  if (!value) return "Autre — courtage";
  return emailCategoryLabels[value as EmailCategory] ?? value;
}

// ---------------------------------------------------------------------------
// Suggested actions
// ---------------------------------------------------------------------------
export const suggestionTypes = [
  "attach_document",
  "draft_reply",
  "create_client",
  "declare_claim",
  "flag_renewal",
] as const;

export type SuggestionType = (typeof suggestionTypes)[number];

export const suggestionTypeLabels: Record<SuggestionType, string> = {
  attach_document: "Rattacher la pièce jointe",
  draft_reply: "Préparer un brouillon de réponse",
  create_client: "Créer le dossier client",
  declare_claim: "Pré-remplir une déclaration de sinistre",
  flag_renewal: "Signaler l’échéance",
};

/** Short verb shown on the accept button. */
export const suggestionAcceptLabels: Record<SuggestionType, string> = {
  attach_document: "Rattacher",
  draft_reply: "Créer le brouillon",
  create_client: "Créer le dossier",
  declare_claim: "Créer le sinistre",
  flag_renewal: "Noter",
};

export function isSuggestionType(value: string): value is SuggestionType {
  return (suggestionTypes as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Attachment classification → broker_documents category
// ---------------------------------------------------------------------------
/** Categories the AI may assign to an attachment (subset of doc categories). */
export const attachmentDocCategories = [
  "company_quote",
  "contract",
  "rib",
  "id_document",
  "other",
] as const;

export type AttachmentDocCategory = (typeof attachmentDocCategories)[number];

export function isAttachmentDocCategory(
  value: string,
): value is AttachmentDocCategory {
  return (attachmentDocCategories as readonly string[]).includes(value);
}

export function normalizeAttachmentCategory(
  value: string | null | undefined,
): AttachmentDocCategory {
  if (value && isAttachmentDocCategory(value)) return value;
  return "other";
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------
export function senderInitials(name: string | null | undefined): string {
  const base = (name ?? "").trim();
  if (!base) return "@";
  return (
    base
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.at(0)?.toUpperCase() ?? "")
      .join("") || "@"
  );
}
