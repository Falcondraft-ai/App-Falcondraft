export const CALL_SUMMARY_GENERATION_EVENT =
  "falcondraft:call-summary-generation-updated";

export const PROPOSAL_GENERATION_EVENT =
  "falcondraft:proposal-generation-updated";

export function getCallSummaryGenerationStorageKey(dealId: string) {
  return `falcondraft:call-summary-generating:${dealId}`;
}

export function getProposalGenerationStorageKey(dealId: string) {
  return `falcondraft:proposal-generating:${dealId}`;
}
