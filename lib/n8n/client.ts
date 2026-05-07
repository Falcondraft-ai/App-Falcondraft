import type {
  WorkflowTriggerInput,
  WorkflowTriggerResult,
} from "@/lib/n8n/types";

export function isN8nConfigured() {
  return Boolean(
    process.env.N8N_WEBHOOK_BASE_URL && process.env.N8N_WEBHOOK_SECRET,
  );
}

export async function triggerWorkflow(
  input: WorkflowTriggerInput,
): Promise<WorkflowTriggerResult> {
  // Step 1 intentionally never calls real automation webhooks.
  // Later this function will sign a server-side request, call the correct webhook,
  // create/update workflow_runs, and return only client-safe status fields.
  return {
    requestId: input.requestId,
    workflowRunId: `mock_${input.requestId}`,
    status: "queued",
    message:
      "La génération est prête à être orchestrée dans une prochaine étape.",
  };
}
