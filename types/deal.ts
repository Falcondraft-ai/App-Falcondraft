export const dealStatuses = [
  "draft",
  "call_summary_ready",
  "proposal_generating",
  "proposal_ready",
  "validation_pending",
  "final_document_generating",
  "final_document_ready",
  "signature_ready",
  "email_draft_ready",
  "completed",
  "failed",
] as const;

export type DealStatus = (typeof dealStatuses)[number];

export const dealStatusLabels = {
  draft: "Brouillon",
  call_summary_ready: "Compte-rendu prêt",
  proposal_generating: "Proposition en cours",
  proposal_ready: "Proposition prête",
  validation_pending: "En attente de validation",
  final_document_generating: "Document final en cours",
  final_document_ready: "Document final prêt",
  signature_ready: "Signature prête",
  email_draft_ready: "Email prêt",
  completed: "Terminé",
  failed: "Erreur",
} satisfies Record<DealStatus, string>;

export type DealPriority = "standard" | "important" | "urgent";

export type Deal = {
  id: string;
  name: string;
  clientCompanyName: string;
  clientContactName: string;
  clientEmail: string;
  clientPhone?: string;
  status: DealStatus;
  createdAt: string;
  updatedAt: string;
  lastAction: string;
  amountEstimate: number;
  ownerName: string;
  priority: DealPriority;
  expectedCloseDate: string;
  source: string;
  transcript: string;
  additionalContext: string;
  emailInstructions: string;
  clientCompanyInfo?: string;
  callSummary: string;
  hasCallSummary: boolean;
  proposalTitle: string;
  proposalExcerpt: string;
  finalDocumentName: string;
  signatureUrl: string;
  emailDraft: {
    subject: string;
    body: string;
  };
};
