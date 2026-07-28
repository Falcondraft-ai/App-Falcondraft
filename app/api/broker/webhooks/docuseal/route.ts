import { NextResponse, type NextRequest } from "next/server";
import {
  getSubmissionState,
  isAuthorizedDocusealWebhook,
  parseDocusealWebhook,
} from "@/lib/broker/docuseal";
import { applyAdviceSignatureState } from "@/lib/broker/signature";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BrokerAdviceRow } from "@/types/database";

// Downloads the signed PDF into the GED → Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound signature-provider webhook (form.viewed / started / completed /
 * declined). Public route by necessity — there is no user session — so it is
 * authenticated by a shared secret and nothing else:
 *
 *  - the secret comes from `DOCUSEAL_WEBHOOK_SECRET` and is compared in
 *    constant time (header `X-Docuseal-Secret`, or `?token=` when the provider
 *    can only be given a URL);
 *  - the payload is never trusted to name its own organization: the record is
 *    resolved from the submission id we stored when creating the request, and
 *    the organization is read from that row.
 *
 * Always answers 200 on anything we simply don't handle — a 4xx would make the
 * provider retry the same unusable event for 48 hours.
 */
export async function POST(request: NextRequest) {
  if (!process.env.DOCUSEAL_WEBHOOK_SECRET) {
    console.error("[docuseal] webhook received but no secret configured");
    return NextResponse.json(
      { received: false, reason: "not_configured" },
      { status: 503 },
    );
  }

  if (!isAuthorizedDocusealWebhook(request)) {
    return NextResponse.json(
      { received: false, reason: "unauthorized" },
      { status: 401 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const event = parseDocusealWebhook(body);
  if (!event) {
    return NextResponse.json({ received: true, handled: false });
  }

  // form.started carries no state we surface — viewed already covers "the
  // client has the document open".
  if (event.type === "form.started") {
    return NextResponse.json({ received: true, handled: false });
  }

  if (!event.submissionId) {
    return NextResponse.json({ received: true, handled: false });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    console.error("[docuseal] webhook: admin client unavailable");
    return NextResponse.json(
      { received: false, reason: "unavailable" },
      { status: 503 },
    );
  }

  // Resolve by the submission id we stored ourselves. The metadata we set at
  // creation is only used as a cross-check — never as the source of tenancy.
  const { data } = await admin
    .from("broker_advice")
    .select(
      "id, organization_id, client_id, created_by, status, signature_status, signature_viewed_at, signed_document_id, docuseal_submission_id",
    )
    .eq("docuseal_submission_id", event.submissionId)
    .maybeSingle();

  const advice = data as Pick<
    BrokerAdviceRow,
    | "id"
    | "organization_id"
    | "client_id"
    | "created_by"
    | "status"
    | "signature_status"
    | "signature_viewed_at"
    | "signed_document_id"
    | "docuseal_submission_id"
  > | null;

  if (!advice) {
    // Not ours (another app on the same provider account) or already purged.
    return NextResponse.json({ received: true, handled: false });
  }

  const expectedAdviceId = event.metadata.advice_id;
  if (expectedAdviceId && expectedAdviceId !== advice.id) {
    console.error("[docuseal] webhook metadata/record mismatch", {
      submissionId: event.submissionId,
    });
    return NextResponse.json({ received: true, handled: false });
  }

  // Re-read the authoritative state from the API rather than trusting the
  // payload: it also gives us the signed-document and audit-log URLs.
  const state = await getSubmissionState(event.submissionId);
  if (!state) {
    // Let the provider retry — this one is a transient failure on our side.
    return NextResponse.json(
      { received: false, reason: "state_unavailable" },
      { status: 503 },
    );
  }

  try {
    const result = await applyAdviceSignatureState({
      adminSupabase: admin,
      organizationId: advice.organization_id,
      advice,
      state,
      userId: null,
    });
    return NextResponse.json({ received: true, handled: result.changed });
  } catch (error) {
    console.error("[docuseal] webhook processing failed:", error);
    return NextResponse.json(
      { received: false, reason: "processing_failed" },
      { status: 500 },
    );
  }
}
