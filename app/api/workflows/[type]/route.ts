import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { triggerWorkflow } from "@/lib/n8n/client";
import { workflowTypes, type WorkflowType } from "@/lib/n8n/types";

const workflowRequestSchema = z.object({
  dealId: z.string().min(1).optional(),
  notes: z.string().max(20_000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type RouteContext = {
  params: Promise<{
    type: string;
  }>;
};

function isWorkflowType(type: string): type is WorkflowType {
  return workflowTypes.some((workflowType) => workflowType === type);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { type } = await context.params;

  if (!isWorkflowType(type)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Le workflow demandé n'est pas disponible.",
      },
      { status: 400 },
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = workflowRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "La demande de génération est incomplète.",
      },
      { status: 400 },
    );
  }

  const requestId = crypto.randomUUID();

  // Future implementation:
  // - validate the authenticated user session
  // - validate that the requested deal belongs to the user's organization
  // - create or update a workflow_runs row with organization_id
  // - call the server-side automation webhook with a signed secret
  // - return only a safe business status to the frontend
  const result = await triggerWorkflow({
    type,
    requestId,
    payload: parsedBody.data,
  });

  return NextResponse.json({
    ok: true,
    requestId: result.requestId,
    workflowRunId: result.workflowRunId,
    status: result.status,
    message: result.message,
  });
}
