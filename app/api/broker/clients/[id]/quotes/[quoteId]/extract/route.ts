import { NextResponse, type NextRequest } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { runQuoteExtraction } from "@/lib/broker/quote-ingest";
import { requireBrokerApiContext } from "@/lib/broker/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string; quoteId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Votre rôle ne permet pas cette action.", 403, "insufficient_role");
  }

  const { id: clientId, quoteId } = await ctx.params;

  const result = await runQuoteExtraction({
    adminSupabase: auth.adminSupabase,
    organizationId: auth.organizationId,
    clientId,
    quoteId,
    userId: auth.user.id,
  });

  if (!result.ok) {
    return jsonError(result.message, result.status, result.reason);
  }
  if (result.skipped) {
    return NextResponse.json({ success: true, skipped: true });
  }
  return NextResponse.json({ success: true, data: result.data });
}
