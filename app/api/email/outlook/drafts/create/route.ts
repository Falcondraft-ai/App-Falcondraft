import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createOutlookDraft } from "@/lib/email/outlook-drafts";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

const MAX_PDF_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const attachmentSchema = z
  .object({
    filename: z.string().trim().min(1).max(180),
    contentType: z.literal("application/pdf").optional(),
    contentBase64: z.string().optional(),
    data: z.string().optional(),
  })
  .strict()
  .refine(
    (attachment) => Boolean(attachment.contentBase64 || attachment.data),
    "PDF attachment content is required.",
  );

const createDraftSchema = z
  .object({
    organization_id: z.string().uuid(),
    user_id: z.string().uuid(),
    deal_id: z.string().uuid().nullable().optional(),
    workflow_run_id: z.string().uuid().nullable().optional(),
    workflowRunId: z.string().uuid().nullable().optional(),
    to: z.string().trim().email(),
    subject: z.string().trim().min(1),
    body: z.string().refine((value) => value.trim().length > 0),
    attachments: z.array(attachmentSchema).max(1).optional(),
  })
  .strict();

const auditTargetSchema = z
  .object({
    organization_id: z.string().uuid(),
    user_id: z.string().uuid(),
    deal_id: z.string().uuid().nullable().optional(),
  })
  .passthrough();

type ParsedCreateDraftBody = z.infer<typeof createDraftSchema>;
type ParsedAttachment = NonNullable<
  ParsedCreateDraftBody["attachments"]
>[number];

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

function getConfiguredSecret() {
  return process.env.N8N_EMAIL_DRAFT_SECRET?.trim() ?? "";
}

function getRequestSecret(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return (
    request.headers.get("x-n8n-email-draft-secret")?.trim() ??
    request.headers.get("x-falcondraft-email-draft-secret")?.trim() ??
    ""
  );
}

function isValidSecret(requestSecret: string, configuredSecret: string) {
  if (!requestSecret || !configuredSecret) {
    return false;
  }

  const requestBuffer = Buffer.from(requestSecret);
  const configuredBuffer = Buffer.from(configuredSecret);

  if (requestBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return timingSafeEqual(requestBuffer, configuredBuffer);
}

function normalizeBase64Pdf(value: string) {
  const trimmedValue = value.trim();
  const dataUrlMatch = trimmedValue.match(
    /^data:application\/pdf;base64,(.*)$/i,
  );

  return (dataUrlMatch?.[1] ?? trimmedValue).replace(/\s/g, "");
}

function parsePdfAttachment(attachment: ParsedAttachment) {
  const normalizedBase64 = normalizeBase64Pdf(
    attachment.contentBase64 || attachment.data || "",
  );

  if (
    !normalizedBase64 ||
    normalizedBase64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedBase64)
  ) {
    throw new Error("invalid_pdf_attachment");
  }

  const contentBuffer = Buffer.from(normalizedBase64, "base64");

  if (contentBuffer.byteLength > MAX_PDF_ATTACHMENT_BYTES) {
    throw new Error("pdf_attachment_too_large");
  }

  if (contentBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("invalid_pdf_attachment");
  }

  return {
    filename: attachment.filename,
    contentType: "application/pdf" as const,
    contentBase64: contentBuffer.toString("base64"),
  };
}

async function insertDraftAuditLog(
  adminSupabase: SupabaseClient<Database>,
  input: {
    organizationId: string;
    userId: string;
    action: "email_draft_created" | "email_draft_failed";
    dealId: string | null;
  },
) {
  const { error } = await adminSupabase.from("audit_logs").insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    action: input.action,
    entity_type: input.dealId ? "deal" : "email_draft",
    entity_id: input.dealId,
  });

  if (error) {
    console.warn("Outlook draft audit log insert failed.", {
      organizationId: input.organizationId,
      userId: input.userId,
      dealId: input.dealId,
      action: input.action,
      reason: error.message,
    });
  }
}

function getWorkflowRunId(input: ParsedCreateDraftBody) {
  return input.workflow_run_id ?? input.workflowRunId ?? null;
}

async function getLatestPendingEmailDraftWorkflowRunId(
  adminSupabase: SupabaseClient<Database>,
  input: { organizationId: string; dealId: string },
) {
  const { data, error } = await adminSupabase
    .from("workflow_runs")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("deal_id", input.dealId)
    .eq("type", "email_draft_generation")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("Outlook draft workflow lookup failed.", {
      organizationId: input.organizationId,
      dealId: input.dealId,
      reason: error.message,
    });
  }

  return data?.id ?? null;
}

async function completeEmailDraftWorkflow(
  adminSupabase: SupabaseClient<Database>,
  input: {
    organizationId: string;
    dealId: string | null;
    workflowRunId: string | null;
  },
) {
  if (!input.dealId) {
    return;
  }

  const completedAt = new Date().toISOString();

  const { error: dealUpdateError } = await adminSupabase
    .from("deals")
    .update({ status: "email_draft_ready", updated_at: completedAt })
    .eq("id", input.dealId)
    .eq("organization_id", input.organizationId)
    .neq("status", "completed");

  if (dealUpdateError) {
    console.warn("Outlook draft deal status update failed.", {
      organizationId: input.organizationId,
      dealId: input.dealId,
      reason: dealUpdateError.message,
    });
  }

  const workflowRunId =
    input.workflowRunId ??
    (await getLatestPendingEmailDraftWorkflowRunId(adminSupabase, {
      organizationId: input.organizationId,
      dealId: input.dealId,
    }));

  if (!workflowRunId) {
    return;
  }

  const { error: workflowUpdateError } = await adminSupabase
    .from("workflow_runs")
    .update({ status: "completed", completed_at: completedAt, error_message: null })
    .eq("id", workflowRunId)
    .eq("organization_id", input.organizationId)
    .eq("deal_id", input.dealId)
    .eq("type", "email_draft_generation");

  if (workflowUpdateError) {
    console.warn("Outlook draft workflow completion update failed.", {
      organizationId: input.organizationId,
      dealId: input.dealId,
      workflowRunId,
      reason: workflowUpdateError.message,
    });
  }
}

function statusForDraftError(error: unknown) {
  if (!(error instanceof Error)) return 502;
  if (error.message.includes("Utilisateur non autorisé")) return 403;
  if (error.message.includes("Aucune connexion Outlook active")) return 409;
  return 502;
}

export async function POST(request: NextRequest) {
  const configuredSecret = getConfiguredSecret();

  if (!configuredSecret) {
    console.error("N8N_EMAIL_DRAFT_SECRET is not configured.");
    return jsonError(
      "Email draft endpoint is not configured.",
      500,
      "endpoint_unconfigured",
    );
  }

  if (!isValidSecret(getRequestSecret(request), configuredSecret)) {
    console.warn("Rejected unauthorized n8n Outlook draft request.");
    return jsonError("Unauthorized.", 401, "unauthorized");
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return jsonError(
      "Email draft endpoint is not configured.",
      500,
      "service_role_unconfigured",
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsedBody = createDraftSchema.safeParse(body);

  if (!parsedBody.success) {
    const auditTarget = auditTargetSchema.safeParse(body);

    if (auditTarget.success) {
      await insertDraftAuditLog(adminSupabase, {
        organizationId: auditTarget.data.organization_id,
        userId: auditTarget.data.user_id,
        action: "email_draft_failed",
        dealId: auditTarget.data.deal_id ?? null,
      });
    }

    console.warn("Rejected invalid n8n Outlook draft payload.");
    return jsonError("Invalid email draft payload.", 400, "invalid_payload");
  }

  const dealId = parsedBody.data.deal_id ?? null;
  const workflowRunId = getWorkflowRunId(parsedBody.data);

  const { data: membership, error: membershipError } = await adminSupabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", parsedBody.data.organization_id)
    .eq("user_id", parsedBody.data.user_id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    await insertDraftAuditLog(adminSupabase, {
      organizationId: parsedBody.data.organization_id,
      userId: parsedBody.data.user_id,
      action: "email_draft_failed",
      dealId,
    });
    return jsonError(
      "User is not active in this organization.",
      403,
      "forbidden",
    );
  }

  if (dealId) {
    const { data: deal, error: dealError } = await adminSupabase
      .from("deals")
      .select("id")
      .eq("id", dealId)
      .eq("organization_id", parsedBody.data.organization_id)
      .maybeSingle();

    if (dealError || !deal) {
      await insertDraftAuditLog(adminSupabase, {
        organizationId: parsedBody.data.organization_id,
        userId: parsedBody.data.user_id,
        action: "email_draft_failed",
        dealId,
      });
      return jsonError(
        "Deal not found for this organization.",
        404,
        "deal_not_found",
      );
    }
  }

  let attachments;

  try {
    attachments = parsedBody.data.attachments?.map(parsePdfAttachment);
  } catch (error) {
    await insertDraftAuditLog(adminSupabase, {
      organizationId: parsedBody.data.organization_id,
      userId: parsedBody.data.user_id,
      action: "email_draft_failed",
      dealId,
    });
    return jsonError("Invalid PDF attachment.", 400, "invalid_pdf_attachment");
  }

  try {
    const draft = await createOutlookDraft({
      organizationId: parsedBody.data.organization_id,
      userId: parsedBody.data.user_id,
      to: parsedBody.data.to,
      subject: parsedBody.data.subject,
      body: parsedBody.data.body,
      attachments,
    });

    await insertDraftAuditLog(adminSupabase, {
      organizationId: parsedBody.data.organization_id,
      userId: parsedBody.data.user_id,
      action: "email_draft_created",
      dealId,
    });
    await completeEmailDraftWorkflow(adminSupabase, {
      organizationId: parsedBody.data.organization_id,
      dealId,
      workflowRunId,
    });

    console.info("Created Outlook draft from n8n workflow.", {
      organizationId: parsedBody.data.organization_id,
      userId: parsedBody.data.user_id,
      dealId,
    });

    return NextResponse.json({
      success: true,
      draft: {
        id: draft.draftId,
        message_id: draft.messageId,
      },
    });
  } catch (error) {
    await insertDraftAuditLog(adminSupabase, {
      organizationId: parsedBody.data.organization_id,
      userId: parsedBody.data.user_id,
      action: "email_draft_failed",
      dealId,
    });
    console.error("Failed to create Outlook draft from n8n workflow.", {
      organizationId: parsedBody.data.organization_id,
      userId: parsedBody.data.user_id,
      dealId,
      reason: error instanceof Error ? error.message : "unknown_error",
    });

    return jsonError(
      "Outlook draft creation failed.",
      statusForDraftError(error),
      "outlook_draft_failed",
    );
  }
}
