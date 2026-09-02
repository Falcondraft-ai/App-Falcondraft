import "server-only";

import type {
  ClientSearchCriteria,
  OutlookAttachmentMeta,
  OutlookMessage,
  OutlookMessageBody,
} from "@/lib/email/outlook-read";

/**
 * Contrat commun à toutes les boîtes email, quel que soit l'hébergeur.
 *
 * Deux mondes coexistent :
 *   - OAuth (Microsoft 365, Google) — l'API du fournisseur fait le gros du
 *     travail : recherche plein texte, extraction du corps, pièces jointes.
 *   - IMAP/SMTP (IONOS, OVH, Gandi, un serveur maison…) — protocole brut, tout
 *     est à faire à la main, mais c'est le seul moyen d'atteindre les cabinets
 *     qui ne sont hébergés ni chez Microsoft ni chez Google. Beaucoup utilisent
 *     Outlook comme LOGICIEL sans avoir la moindre boîte Microsoft derrière.
 *
 * Le briefing, les dossiers clients et les brouillons parlent à cette interface
 * et ignorent lequel des deux est branché.
 *
 * Les types de messages sont ceux d'`outlook-read` : ils décrivent un email, pas
 * une particularité Microsoft, et les réutiliser évite un renommage massif pour
 * une forme strictement identique.
 */
export type MailMessage = OutlookMessage;
export type MailMessageBody = OutlookMessageBody;
export type MailAttachmentMeta = OutlookAttachmentMeta;
export type MailSearchCriteria = ClientSearchCriteria;

export type MailboxPage = {
  messages: MailMessage[];
  /** Le plafond a coupé la fenêtre : il reste du courrier plus ancien. */
  truncated: boolean;
};

export type MailDraftAttachment = {
  filename: string;
  contentType: string;
  contentBase64: string;
};

export type MailDraft = {
  to: string;
  subject: string;
  /** Corps en texte brut ; les sauts de ligne sont convertis à l'envoi. */
  body: string;
  cc?: string[];
  attachments?: MailDraftAttachment[];
};

export type MailDraftResult = {
  ok: boolean;
  /** Identifiant du brouillon chez le fournisseur, quand il en donne un. */
  draftId?: string;
  /** Adresse depuis laquelle le brouillon a été préparé. */
  email?: string;
  message?: string;
};

export interface MailboxClient {
  /** Adresse principale de la boîte. */
  readonly address: string;
  /** Adresse principale + alias, en minuscules — sert à détecter les envois. */
  readonly addresses: string[];
  /** Fournisseur, pour les messages d'erreur et les journaux. */
  readonly provider: "outlook" | "imap";

  /**
   * Messages reçus depuis `sinceIso`, du plus ANCIEN au plus récent par défaut.
   * L'ordre chronologique est ce qui permet à un run plafonné de reprendre
   * exactement là où il s'est arrêté.
   */
  listInbox(
    sinceIso: string,
    max: number,
    options?: { order?: "asc" | "desc" },
  ): Promise<MailboxPage>;

  /** Corps complet, HTML converti en texte. */
  getBody(messageId: string): Promise<MailMessageBody | null>;

  /** Pièces jointes réelles d'un message (métadonnées seules). */
  listAttachments(messageId: string): Promise<MailAttachmentMeta[]>;

  /** Contenu d'une pièce jointe, en base64. */
  getAttachmentBytes(
    messageId: string,
    attachmentId: string,
  ): Promise<{ name: string; contentType: string; contentBase64: string } | null>;

  /** Tout ce qui concerne un client : échanges directs ET simples mentions. */
  searchForClient(
    criteria: MailSearchCriteria,
    query?: string,
    max?: number,
  ): Promise<MailMessage[]>;

  /** Dépose un brouillon dans la boîte — rien ne part sans le courtier. */
  createDraft(draft: MailDraft): Promise<MailDraftResult>;

  /**
   * Libère la connexion. Sans objet en OAuth (HTTP sans état), indispensable en
   * IMAP où une session TCP reste ouverte.
   */
  close(): Promise<void>;
}
