export const CALL_SUMMARY_GENERATION_EVENT =
  "falcondraft:call-summary-generation-updated";

export const PROPOSAL_GENERATION_EVENT =
  "falcondraft:proposal-generation-updated";

export const PROPOSAL_VALIDATION_EVENT =
  "falcondraft:proposal-validation-updated";

export const EMAIL_DRAFT_GENERATION_EVENT =
  "falcondraft:email-draft-generation-updated";

export function getCallSummaryGenerationStorageKey(dealId: string) {
  return `falcondraft:call-summary-generating:${dealId}`;
}

export function getProposalGenerationStorageKey(dealId: string) {
  return `falcondraft:proposal-generating:${dealId}`;
}

export function getProposalValidationStorageKey(dealId: string) {
  return `falcondraft:proposal-validation-generating:${dealId}`;
}

export function getEmailDraftGenerationStorageKey(dealId: string) {
  return `falcondraft:email-draft-generating:${dealId}`;
}
