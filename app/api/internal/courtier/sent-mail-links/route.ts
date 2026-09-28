import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { linkSentMail, type SentMailTarget } from "@/lib/broker/sent-mail-links";
import { outlookOAuthProvider } from "@/lib/email/microsoft-oauth";
import { IMAP_PROVIDER } from "@/lib/email/mailbox-resolver";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Internal cron endpoint: files each broker mailbox's SENT emails into the
 * dossiers they were addressed to (lib/broker/sent-mail-links.ts).
 *
 * Unlike the briefing, "sur mesure" cabinets are included: this reads mail and
 * matches addresses, it spends no AI and decides nothing the broker must see
 * first. Opening a dossier also triggers it for that cabinet, so this run is the
 * safety net for dossiers nobody opened.
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

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { success: false, reason: "service_unconfigured" },
      { status: 500 },
    );
  }

  const { data: connections } = await admin
    .from("email_connections")
    .select("id, organization_id, user_id, profile_id, sent_synced_at")
    .in("provider", [IMAP_PROVIDER, outlookOAuthProvider])
    .eq("status", "connected")
    .limit(500);

  const targets = (connections ?? []) as SentMailTarget[];
  const orgIds = [...new Set(targets.map((t) => t.organization_id))];
  const brokerOrgIds = new Set<string>();
  if (orgIds.length > 0) {
    const { data: orgs } = await admin
      .from("organizations")
      .select("id, workspace_type")
      .in("id", orgIds);
    for (const org of orgs ?? []) {
      if (org.workspace_type === "insurance_broker") brokerOrgIds.add(org.id);
    }
  }

  let scanned = 0;
  let linked = 0;
  let failed = 0;
  for (const target of targets) {
    if (!brokerOrgIds.has(target.organization_id)) continue;
    const result = await linkSentMail(admin, target).catch((error: unknown) => {
      console.error("[broker] sent mail linking failed:", error);
      return null;
    });
    if (!result) {
      failed += 1;
      continue;
    }
    scanned += result.scanned;
    linked += result.linked;
  }

  return NextResponse.json({ success: true, scanned, linked, failed });
}
