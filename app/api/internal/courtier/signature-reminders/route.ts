import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { hasFeature } from "@/lib/billing/entitlements";
import {
  getSubmissionState,
  isDocusealConfigured,
  resendSignatureRequest,
} from "@/lib/broker/docuseal";
import { logBrokerActivity } from "@/lib/broker/server";
import { parseBrokerSettings } from "@/lib/broker/settings";
import {
  applyAdviceSignatureState,
  buildReminderMessage,
  PENDING_SIGNATURE_STATUSES,
  REMINDER_FIRST_DELAY_MS,
  REMINDER_MAX_COUNT,
  REMINDER_MIN_INTERVAL_MS,
} from "@/lib/broker/signature";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BrokerAdviceRow, Database, OrganizationRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type BrokerAdviceUpdate =
  Database["public"]["Tables"]["broker_advice"]["Update"];

/** Delay between two automatic reminders after the first one. */
const REMINDER_INTERVAL_MS = 4 * 86_400_000;

/** Safety bound so one run can't fan out into hundreds of provider calls. */
const MAX_PER_RUN = 200;

// Declared as a const so TypeScript keeps the literal type PostgREST needs to
// infer the row shape (an inline concatenation would widen it to `string`).
const PENDING_ADVICE_FIELDS =
  "id, organization_id, client_id, created_by, status, signature_status, signature_viewed_at, signed_document_id, docuseal_submission_id, docuseal_submitter_id, signature_sent_at, signature_last_reminder_at, signature_reminder_count, signature_expires_at";

type PendingAdvice = Pick<
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
  | "docuseal_submitter_id"
  | "signature_sent_at"
  | "signature_last_reminder_at"
  | "signature_reminder_count"
  | "signature_expires_at"
>;

/**
 * Internal cron: chases pending electronic signatures.
 *
 * For each devoir de conseil still awaiting signature it (1) re-syncs the state
 * with the provider — a safety net for any webhook that was missed — and (2)
 * sends a reminder once the request has been silent long enough. Reminders stop
 * after REMINDER_MAX_COUNT: past that it's a phone call, not another email.
 *
 *   Vercel Cron: `Authorization: Bearer <CRON_SECRET>` (automatic).
 *   Manual:      header `X-N8N-Secret` / `x-cron-secret` = CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { success: false, reason: "cron_not_configured" },
      { status: 503 },
    );
  }
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { success: false, reason: "unauthorized" },
      { status: 401 },
    );
  }
  if (!isDocusealConfigured()) {
    return NextResponse.json({ success: true, skipped: "esign_not_configured" });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { success: false, reason: "unavailable" },
      { status: 503 },
    );
  }

  const { data, error } = await admin
    .from("broker_advice")
    .select(PENDING_ADVICE_FIELDS)
    .in("signature_status", PENDING_SIGNATURE_STATUSES)
    .not("docuseal_submission_id", "is", null)
    .order("signature_sent_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    console.error("[broker] signature reminder scan failed:", error.message);
    return NextResponse.json(
      { success: false, reason: "scan_failed" },
      { status: 500 },
    );
  }

  const pending = (data ?? []) as PendingAdvice[];
  const organizations = new Map<string, OrganizationRow | null>();
  let synced = 0;
  let reminded = 0;
  let expired = 0;

  for (const advice of pending) {
    // 1. Re-sync — catches any webhook we never received.
    if (advice.docuseal_submission_id) {
      const state = await getSubmissionState(advice.docuseal_submission_id);
      if (state) {
        const result = await applyAdviceSignatureState({
          adminSupabase: admin,
          organizationId: advice.organization_id,
          advice,
          state,
          userId: null,
        });
        if (result.changed) {
          synced += 1;
          // Signed, declined or expired in the meantime — nothing to chase.
          continue;
        }
      }
    }

    // 2. Local expiry, in case the provider hasn't flipped the status yet.
    const expiresAt = advice.signature_expires_at
      ? new Date(advice.signature_expires_at).getTime()
      : null;
    if (expiresAt && expiresAt < Date.now()) {
      await admin
        .from("broker_advice")
        .update({
          signature_status: "expired",
          updated_at: new Date().toISOString(),
        } satisfies BrokerAdviceUpdate)
        .eq("organization_id", advice.organization_id)
        .eq("id", advice.id);
      await logBrokerActivity(admin, {
        organizationId: advice.organization_id,
        clientId: advice.client_id,
        userId: null,
        type: "advice_signature_expired",
        description: "Le lien de signature a expiré sans être signé.",
        metadata: { advice_id: advice.id },
      });
      expired += 1;
      continue;
    }

    // 3. Reminder, if it's been quiet long enough.
    if (!advice.docuseal_submitter_id) continue;
    if ((advice.signature_reminder_count ?? 0) >= REMINDER_MAX_COUNT) continue;

    const lastActivity = advice.signature_last_reminder_at
      ? new Date(advice.signature_last_reminder_at).getTime()
      : advice.signature_sent_at
        ? new Date(advice.signature_sent_at).getTime()
        : null;
    if (!lastActivity) continue;

    const requiredSilence = advice.signature_last_reminder_at
      ? Math.max(REMINDER_INTERVAL_MS, REMINDER_MIN_INTERVAL_MS)
      : REMINDER_FIRST_DELAY_MS;
    if (Date.now() - lastActivity < requiredSilence) continue;

    if (!organizations.has(advice.organization_id)) {
      const { data: org } = await admin
        .from("organizations")
        .select("*")
        .eq("id", advice.organization_id)
        .maybeSingle();
      organizations.set(
        advice.organization_id,
        (org as OrganizationRow | null) ?? null,
      );
    }
    const organization = organizations.get(advice.organization_id) ?? null;
    // An organization that lost the feature stops getting reminders.
    if (!organization || !hasFeature(organization, "esign")) continue;

    const settings = parseBrokerSettings(organization);
    const sent = await resendSignatureRequest(
      advice.docuseal_submitter_id,
      buildReminderMessage(settings.compliance.legalName),
    );
    if (!sent) continue;

    const now = new Date().toISOString();
    await admin
      .from("broker_advice")
      .update({
        signature_last_reminder_at: now,
        signature_reminder_count: (advice.signature_reminder_count ?? 0) + 1,
        updated_at: now,
      } satisfies BrokerAdviceUpdate)
      .eq("organization_id", advice.organization_id)
      .eq("id", advice.id);

    await logBrokerActivity(admin, {
      organizationId: advice.organization_id,
      clientId: advice.client_id,
      userId: null,
      type: "advice_signature_reminded",
      description: "Rappel de signature envoyé automatiquement au client.",
      metadata: { advice_id: advice.id, automatic: true },
    });
    reminded += 1;
  }

  return NextResponse.json({
    success: true,
    scanned: pending.length,
    synced,
    reminded,
    expired,
  });
}
