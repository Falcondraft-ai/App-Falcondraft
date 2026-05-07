export const workflowTypes = [
  "proposal",
  "quote",
  "document",
  "signature",
  "email",
  "complete-proposal",
] as const;

export type WorkflowType = (typeof workflowTypes)[number];

export type WorkflowTriggerPayload = {
  dealId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type WorkflowTriggerInput = {
  type: WorkflowType;
  requestId: string;
  payload: WorkflowTriggerPayload;
};

export type WorkflowTriggerResult = {
  requestId: string;
  workflowRunId: string;
  status: "queued";
  message: string;
};
