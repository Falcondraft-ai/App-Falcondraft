export const documentTypes = [
  "proposal",
  "proposal_gamma",
  "proposal_pdf",
  "proposal_pdf_initial",
  "quote",
  "quote_pdf",
  "final_document",
  "final_document_pdf",
  "signature_link",
] as const;

export type DocumentType = (typeof documentTypes)[number];

export const documentTypeLabels = {
  proposal: "Proposition",
  proposal_gamma: "Proposition éditable",
  proposal_pdf: "PDF proposition",
  proposal_pdf_initial: "PDF proposition",
  quote: "Devis",
  quote_pdf: "Devis PDF",
  final_document: "Document final",
  final_document_pdf: "Document final prêt à signer",
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
  rawType: string;
  title: string;
  relatedDealId: string;
  relatedDealName: string;
  clientCompanyName: string;
  createdAt: string;
  status: DocumentStatus;
  ownerName: string;
  url?: string;
  hasStoragePath: boolean;
};

export type GeneratedDealDocument = {
  id: string;
  type: string;
  label: string;
  title: string;
  status: DocumentStatus;
  createdAt: string;
  url?: string;
  hasStoragePath: boolean;
  source?: "documents" | "billing_documents";
  downloadUrl?: string;
};
