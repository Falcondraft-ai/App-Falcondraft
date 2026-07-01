import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateDigest } from "@/lib/broker/email-digest";
import { outlookOAuthProvider } from "@/lib/email/microsoft-oauth";
import type { OrganizationRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Internal cron endpoint: generates the daily Outlook briefing for every broker
 * who has a connected Outlook mailbox. Driven natively by Vercel Cron (GET) or
 * any scheduler with the shared secret — never from the browser. No user
 * session: it runs with the service-role client.
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

  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) {
    return NextResponse.json(
      { success: false, reason: "service_unconfigured" },
      { status: 500 },
    );
  }

  // All connected Outlook mailboxes, capped per run.
  const { data: connections } = await adminSupabase
    .from("email_connections")
    .select("organization_id, user_id")
    .eq("provider", outlookOAuthProvider)
    .eq("status", "connected")
    .limit(500);

  const targets = (connections ?? []) as {
    organization_id: string;
    user_id: string;
  }[];

  // Only process insurance-broker workspaces.
  const orgIds = [...new Set(targets.map((t) => t.organization_id))];
  const brokerOrgIds = new Set<string>();
  if (orgIds.length > 0) {
    const { data: orgs } = await adminSupabase
      .from("organizations")
      .select("id, workspace_type")
      .in("id", orgIds);
    for (const org of (orgs ?? []) as Pick<
      OrganizationRow,
      "id" | "workspace_type"
    >[]) {
      if (org.workspace_type === "insurance_broker") brokerOrgIds.add(org.id);
    }
  }

  let processed = 0;
  let failed = 0;

  for (const target of targets) {
    if (!brokerOrgIds.has(target.organization_id)) continue;

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", target.user_id)
      .maybeSingle();

    const result = await generateDigest({
      adminSupabase,
      organizationId: target.organization_id,
      userId: target.user_id,
      userName: profile?.full_name?.split(" ")[0] ?? "le courtier",
    }).catch(() => null);

    if (result?.success) processed += 1;
    else failed += 1;
  }

  return NextResponse.json({ success: true, processed, failed });
}
