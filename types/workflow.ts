import type { DealStatus } from "@/types/deal";

export const workflowStepIds = [
  "opportunity",
  "summary",
  "proposal",
  "validation",
  "final_document",
  "signature",
  "email",
] as const;

export type WorkflowStepId = (typeof workflowStepIds)[number];

export type WorkflowStepStatus = "done" | "active" | "pending" | "failed";

export type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  description: string;
  status: WorkflowStepStatus;
  completedAt?: string;
};

export const workflowStepDefinitions = [
  {
    id: "opportunity",
    label: "Dossier",
    description: "Informations client et contexte initial.",
  },
  {
    id: "summary",
    label: "Compte-rendu",
    description: "Synthèse structurée des notes d’échange.",
  },
  {
    id: "proposal",
    label: "Proposition",
    description: "Version professionnelle prête à relire.",
  },
  {
    id: "validation",
    label: "Validation",
    description: "Contrôle interne avant document final.",
  },
  {
    id: "final_document",
    label: "Document final",
    description: "PDF finalisé et prêt à partager.",
  },
  {
    id: "signature",
    label: "Signature",
    description: "Lien de signature préparé.",
  },
  {
    id: "email",
    label: "Brouillon email",
    description: "Message d’envoi prêt à personnaliser.",
  },
] as const satisfies ReadonlyArray<{
  id: WorkflowStepId;
  label: string;
  description: string;
}>;

const statusProgressIndex = {
  draft: 0,
  call_summary_ready: 1,
  proposal_generating: 2,
  proposal_ready: 2,
  validation_pending: 3,
  final_document_generating: 4,
  final_document_ready: 4,
  signature_ready: 5,
  email_draft_ready: 6,
  completed: 7,
  failed: 2,
} satisfies Record<DealStatus, number>;

export function getWorkflowSteps(status: DealStatus): WorkflowStep[] {
  const progressIndex = statusProgressIndex[status];

  return workflowStepDefinitions.map((step, index) => {
    if (status === "failed" && index === progressIndex) {
      return { ...step, status: "failed" };
    }

    if (index < progressIndex) {
      return { ...step, status: "done" };
    }

    if (index === progressIndex && status !== "completed") {
      return { ...step, status: "active" };
    }

    return { ...step, status: status === "completed" ? "done" : "pending" };
  });
}
