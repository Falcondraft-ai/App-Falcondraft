export const CALL_SUMMARY_GENERATION_EVENT =
  "falcondraft:call-summary-generation-updated";

export function getCallSummaryGenerationStorageKey(dealId: string) {
  return `falcondraft:call-summary-generating:${dealId}`;
}
