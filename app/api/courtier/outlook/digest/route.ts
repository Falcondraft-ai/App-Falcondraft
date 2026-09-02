import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { generateDigest } from "@/lib/broker/email-digest";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
// A catch-up run reads hundreds of emails and classifies them in batches; the
// daily briefing is far quicker but shares this ceiling.
export const maxDuration = 300;

// Optional "go back over the last N days" backfill window. Absent → rolling
// daily briefing since the last one.
const schema = z.object({
  windowDays: z.number().int().min(1).max(90).optional(),
});

/**
 * Prénom utilisé dans le briefing : celui du PROFIL actif quand le cabinet en
 * utilise (« Bonjour Frank »), sinon celui du compte.
 */
async function resolveDigestUserName(auth: {
  adminSupabase: SupabaseClient<Database>;
  organizationId: string;
  profileId: string | null;
  context: { profile: { full_name: string | null } | null };
}): Promise<string> {
  if (auth.profileId) {
    const { data } = await auth.adminSupabase
      .from("broker_profiles")
      .select("display_name")
      .eq("organization_id", auth.organizationId)
      .eq("id", auth.profileId)
      .maybeSingle();
    const name = data?.display_name?.trim().split(" ")[0];
    if (name) return name;
  }
  return auth.context.profile?.full_name?.split(" ")[0] ?? "le courtier";
}

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas de générer le briefing.",
      403,
      "insufficient_role",
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const windowDays = parsed.success ? parsed.data.windowDays : undefined;

  const userName = await resolveDigestUserName(auth);

  const result = await generateDigest(
    {
      adminSupabase: auth.adminSupabase,
      organizationId: auth.organizationId,
      userId: auth.user.id,
      userName,
      // Le briefing porte sur la boîte du profil actif, pas sur celle du compte.
      profileId: auth.profileId,
    },
    windowDays ? { windowDays } : undefined,
  );

  if (!result.success) {
    const status = result.reason === "not_connected" ? 409 : 502;
    return jsonError(result.message, status, result.reason);
  }

  return NextResponse.json({
    success: true,
    digestId: result.digestId,
    relevant: result.relevant,
    uncertain: result.uncertain,
    excluded: result.excluded,
    truncated: result.truncated,
  });
}
