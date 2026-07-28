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
  "update_client",
  "declare_claim",
  "flag_renewal",
  "add_note",
] as const;

export type SuggestionType = (typeof suggestionTypes)[number];

export const suggestionTypeLabels: Record<SuggestionType, string> = {
  attach_document: "Rattacher la pièce jointe",
  draft_reply: "Préparer un brouillon de réponse",
  create_client: "Créer le dossier client",
  update_client: "Mettre à jour le dossier",
  declare_claim: "Pré-remplir une déclaration de sinistre",
  flag_renewal: "Signaler l’échéance",
  add_note: "Noter l’information dans le dossier",
};

/** Short verb shown on the accept button. */
export const suggestionAcceptLabels: Record<SuggestionType, string> = {
  attach_document: "Rattacher",
  draft_reply: "Créer le brouillon",
  create_client: "Créer le dossier",
  update_client: "Mettre à jour",
  declare_claim: "Créer le sinistre",
  flag_renewal: "Noter",
  add_note: "Ajouter la note",
};

/**
 * Order in which the proposed actions are listed on an email.
 * `create_client` comes FIRST: every other action needs a dossier to act on,
 * and accepting it links the email and its sibling actions to the new dossier.
 * Showing "ranger la pièce jointe" above "créer le dossier" reads backwards.
 */
export const suggestionDisplayOrder: SuggestionType[] = [
  "create_client",
  "update_client",
  "attach_document",
  "declare_claim",
  "flag_renewal",
  "add_note",
  "draft_reply",
];

/** Sort key for a suggestion type — unknown types go last. */
export function suggestionRank(type: string): number {
  const index = suggestionDisplayOrder.indexOf(type as SuggestionType);
  return index === -1 ? suggestionDisplayOrder.length : index;
}

/** Human label for a client field referenced by an update_client suggestion. */
const updateFieldLabels: Record<string, string> = {
  email: "email",
  phone: "téléphone",
  address: "adresse",
  postal_code: "code postal",
  city: "ville",
  date_of_birth: "date de naissance",
  birth_country: "pays de naissance",
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
// Dossier matching — pre-select where an attachment should be filed
// ---------------------------------------------------------------------------
/**
 * Accent/case/order-insensitive key for a person or company name, so
 * « Jean MARTIN » and « martin jean » collapse to the same value.
 */
export function clientNameKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .sort()
    .join(" ");
}

/**
 * Finds the dossier a document name refers to. Deliberately strict: only an
 * exact, unambiguous name match wins. A near-match would silently file a
 * client's document into someone else's dossier — the broker picks instead.
 */
export function findClientIdByName(
  name: string | null | undefined,
  clients: { id: string; name: string }[],
): string | null {
  if (!name?.trim()) return null;
  const key = clientNameKey(name);
  if (!key) return null;
  const matches = clients.filter((c) => clientNameKey(c.name) === key);
  return matches.length === 1 ? matches[0]!.id : null;
}

// ---------------------------------------------------------------------------
// Suggestion description (shared by the Outlook digest and the dashboard queue)
// ---------------------------------------------------------------------------
function pstr(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Human sentence describing what accepting a suggestion will do. */
export function describeSuggestion(
  type: string,
  payload: Record<string, unknown> | null | undefined,
  clientName: string | null,
): string {
  const p = payload ?? {};
  switch (type) {
    case "attach_document": {
      const file = pstr(p, "file_name") ?? "pièce jointe";
      return clientName
        ? `Ranger « ${file} » dans le dossier ${clientName}`
        : `Ranger « ${file} » (choisir un dossier)`;
    }
    case "draft_reply":
      return pstr(p, "subject")
        ? `Brouillon de réponse — « ${pstr(p, "subject")} »`
        : "Préparer un brouillon de réponse";
    case "create_client": {
      const name =
        pstr(p, "company_name") ||
        [pstr(p, "first_name"), pstr(p, "last_name")]
          .filter(Boolean)
          .join(" ") ||
        pstr(p, "email") ||
        "ce prospect";
      return `Créer le dossier client pour ${name}`;
    }
    case "update_client": {
      const fields = Object.keys(p)
        .filter((k) => k !== "client_id" && updateFieldLabels[k])
        .map((k) => updateFieldLabels[k]);
      const who = clientName ? `le dossier ${clientName}` : "le dossier client";
      return fields.length
        ? `Mettre à jour ${who} : ${fields.join(", ")}`
        : `Mettre à jour ${who}`;
    }
    case "declare_claim":
      return pstr(p, "claim_type")
        ? `Pré-remplir un sinistre — ${pstr(p, "claim_type")}`
        : "Pré-remplir une déclaration de sinistre";
    case "flag_renewal":
      return pstr(p, "note") ?? "Signaler l’échéance mentionnée";
    case "add_note": {
      const note = pstr(p, "note");
      const who = clientName ? `au dossier ${clientName}` : "au dossier";
      return note ? `Noter ${who} : « ${note} »` : `Ajouter une note ${who}`;
    }
    default:
      return suggestionTypeLabels[type as SuggestionType] ?? "Action";
  }
}

// ---------------------------------------------------------------------------
// Multi-adresse — couleurs par adresse de réception
// ---------------------------------------------------------------------------
/**
 * Palette catégorielle pour distinguer visuellement les adresses SMTP regroupées
 * dans une même boîte. Couleurs dédiées au codage par donnée (pas de token CSS
 * sémantique pour « adresse n°N ») — chaque adresse reçoit une teinte stable.
 */
export type MailboxColor = { dot: string; soft: string; fg: string; border: string };

const MAILBOX_PALETTE: MailboxColor[] = [
  { dot: "#2563EB", soft: "#EFF4FF", fg: "#1E40AF", border: "rgba(37,99,235,0.22)" },
  { dot: "#16A34A", soft: "#F0FDF4", fg: "#15803D", border: "rgba(22,163,74,0.22)" },
  { dot: "#B8922A", soft: "#FDF7E8", fg: "#7A5E10", border: "rgba(184,146,42,0.25)" },
  { dot: "#9333EA", soft: "#F6F0FF", fg: "#6D28D9", border: "rgba(147,51,234,0.22)" },
  { dot: "#DC2626", soft: "#FEF2F2", fg: "#B91C1C", border: "rgba(220,38,38,0.22)" },
  { dot: "#0891B2", soft: "#ECFEFF", fg: "#0E7490", border: "rgba(8,145,178,0.22)" },
  { dot: "#EA580C", soft: "#FFF5ED", fg: "#C2410C", border: "rgba(234,88,12,0.22)" },
  { dot: "#DB2777", soft: "#FDF2F8", fg: "#BE185D", border: "rgba(219,39,119,0.22)" },
];

/** Stable color for a mailbox address (deterministic hash → palette index). */
export function mailboxAddressColor(address: string): MailboxColor {
  let hash = 0;
  const key = address.trim().toLowerCase();
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return MAILBOX_PALETTE[hash % MAILBOX_PALETTE.length];
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
