import { NextResponse } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { generateDigest } from "@/lib/broker/email-digest";
import { requireBrokerApiContext } from "@/lib/broker/server";

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST() {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas de générer le briefing.",
      403,
      "insufficient_role",
    );
  }

  const userName =
    auth.context.profile?.full_name?.split(" ")[0] ?? "le courtier";

  const result = await generateDigest({
    adminSupabase: auth.adminSupabase,
    organizationId: auth.organizationId,
    userId: auth.user.id,
    userName,
  });

  if (!result.success) {
    const status = result.reason === "not_connected" ? 409 : 502;
    return jsonError(result.message, status, result.reason);
  }

  return NextResponse.json({
    success: true,
    digestId: result.digestId,
    relevant: result.relevant,
    excluded: result.excluded,
  });
}
