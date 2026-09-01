import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { generateDigest } from "@/lib/broker/email-digest";
import { requireBrokerApiContext } from "@/lib/broker/server";

export const runtime = "nodejs";
// A catch-up run reads hundreds of emails and classifies them in batches; the
// daily briefing is far quicker but shares this ceiling.
export const maxDuration = 300;

// Optional "go back over the last N days" backfill window. Absent → rolling
// daily briefing since the last one.
const schema = z.object({
  windowDays: z.number().int().min(1).max(90).optional(),
});

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

  const userName =
    auth.context.profile?.full_name?.split(" ")[0] ?? "le courtier";

  const result = await generateDigest(
    {
      adminSupabase: auth.adminSupabase,
      organizationId: auth.organizationId,
      userId: auth.user.id,
      userName,
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
