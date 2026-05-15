export const managedWorkflowTypes = [
  "call_summary",
  "proposal_generation",
  "proposal_validation",
  "email_draft_generation",
] as const;

export const workflowConfigStatuses = ["active", "inactive"] as const;

export type ManagedWorkflowType = (typeof managedWorkflowTypes)[number];
export type WorkflowConfigStatus = (typeof workflowConfigStatuses)[number];

export const managedWorkflowLabels: Record<ManagedWorkflowType, string> = {
  call_summary: "Compte-rendu d’appel",
  proposal_generation: "Génération de proposition",
  proposal_validation: "Validation de proposition",
  email_draft_generation: "Brouillon Gmail",
};

export function isManagedWorkflowType(
  value: string,
): value is ManagedWorkflowType {
  return managedWorkflowTypes.includes(value as ManagedWorkflowType);
}

export function isWorkflowConfigStatus(
  value: string,
): value is WorkflowConfigStatus {
  return workflowConfigStatuses.includes(value as WorkflowConfigStatus);
}
