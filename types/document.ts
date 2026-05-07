export const documentTypes = [
  "proposal",
  "proposal_pdf",
  "quote",
  "final_document",
  "signature_link",
] as const;

export type DocumentType = (typeof documentTypes)[number];

export const documentTypeLabels = {
  proposal: "Proposition",
  proposal_pdf: "PDF proposition",
  quote: "Devis",
  final_document: "Document final",
  signature_link: "Lien de signature",
} satisfies Record<DocumentType, string>;

export type DocumentStatus = "ready" | "draft" | "generating" | "sent";

export const documentStatusLabels = {
  ready: "Prêt",
  draft: "Brouillon",
  generating: "En cours",
  sent: "Envoyé",
} satisfies Record<DocumentStatus, string>;

export type MockDocument = {
  id: string;
  type: DocumentType;
  title: string;
  relatedDealId: string;
  relatedDealName: string;
  clientCompanyName: string;
  createdAt: string;
  status: DocumentStatus;
  ownerName: string;
};
