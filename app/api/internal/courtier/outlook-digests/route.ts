import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateDigest } from "@/lib/broker/email-digest";
import { BROKER_OFFERING_CUSTOM, getBrokerOffering } from "@/lib/broker/access";
import { outlookOAuthProvider } from "@/lib/email/microsoft-oauth";
import { IMAP_PROVIDER } from "@/lib/email/mailbox-resolver";
import type { OrganizationRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Internal cron endpoint: generates the daily Outlook briefing for every broker
 * who has a connected Outlook mailbox.
 *
 * Excluded: "courtier sur mesure" organizations (broker_offering = custom).
 * There the briefing is launched by the broker himself from /courtier/inbox —
 * an automatic 6am run is useless on the days he does not work, and it would
 * consume the recent-emails window before he ever sees it. Missed days are
 * caught up with the "Remonter" backfill on the same page.
 *
 * Driven natively by Vercel Cron (GET) or
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

  // Toutes les boîtes connectées, quel que soit le fournisseur : un cabinet
  // hébergé chez IONOS ou OVH n'a aucune connexion Microsoft, seulement de
  // l'IMAP. Le briefing porte sur une BOÎTE, pas sur un compte : un cabinet
  // partagé a une boîte par profil, donc un briefing par personne.
  const { data: connections } = await adminSupabase
    .from("email_connections")
    .select("organization_id, user_id, profile_id")
    .in("provider", [IMAP_PROVIDER, outlookOAuthProvider])
    .eq("status", "connected")
    .limit(500);

  const targets = (connections ?? []) as {
    organization_id: string;
    user_id: string;
    profile_id: string | null;
  }[];

  // Only process insurance-broker workspaces on the self-serve SaaS offering.
  const orgIds = [...new Set(targets.map((t) => t.organization_id))];
  const brokerOrgIds = new Set<string>();
  if (orgIds.length > 0) {
    const { data: orgs } = await adminSupabase
      .from("organizations")
      .select("id, workspace_type, broker_offering")
      .in("id", orgIds);
    for (const org of (orgs ?? []) as Pick<
      OrganizationRow,
      "id" | "workspace_type" | "broker_offering"
    >[]) {
      if (org.workspace_type !== "insurance_broker") continue;
      // Sur mesure : briefing manuel uniquement, lancé par le courtier.
      if (getBrokerOffering(org) === BROKER_OFFERING_CUSTOM) continue;
      brokerOrgIds.add(org.id);
    }
  }

  let processed = 0;
  let failed = 0;

  for (const target of targets) {
    if (!brokerOrgIds.has(target.organization_id)) continue;

    // Le briefing s'adresse à une personne : on prend le prénom du profil quand
    // la boîte en a un, sinon celui du compte.
    let userName: string | null = null;
    if (target.profile_id) {
      const { data: profile } = await adminSupabase
        .from("broker_profiles")
        .select("display_name")
        .eq("id", target.profile_id)
        .maybeSingle();
      userName = profile?.display_name?.trim().split(" ")[0] ?? null;
    }
    if (!userName) {
      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", target.user_id)
        .maybeSingle();
      userName = profile?.full_name?.split(" ")[0] ?? null;
    }

    const result = await generateDigest({
      adminSupabase,
      organizationId: target.organization_id,
      userId: target.user_id,
      profileId: target.profile_id,
      userName: userName ?? "le courtier",
    }).catch(() => null);

    if (result?.success) processed += 1;
    else failed += 1;
  }

  return NextResponse.json({ success: true, processed, failed });
}
