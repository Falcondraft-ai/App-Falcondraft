import { NextResponse, type NextRequest } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { generateAdviceContent } from "@/lib/broker/advice-ai";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type { BrokerClientRow, BrokerQuoteRow } from "@/types/database";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; adviceId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Votre rôle ne permet pas cette action.", 403, "insufficient_role");
  }

  const { id: clientId, adviceId } = await ctx.params;

  const { data: advice } = await auth.adminSupabase
    .from("broker_advice")
    .select("client_id, quote_id")
    .eq("organization_id", auth.organizationId)
    .eq("id", adviceId)
    .maybeSingle();
  if (!advice || advice.client_id !== clientId) {
    return jsonError("Devoir de conseil introuvable.", 404, "advice_not_found");
  }

  const { data: client } = await auth.adminSupabase
    .from("broker_clients")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .eq("id", clientId)
    .maybeSingle();
  if (!client) {
    return jsonError("Dossier introuvable.", 404, "client_not_found");
  }

  // Prefer the quote linked to the advice; else the latest validated quote.
  let quote: BrokerQuoteRow | null = null;
  if (advice.quote_id) {
    const { data } = await auth.adminSupabase
      .from("broker_quotes")
      .select("*")
      .eq("organization_id", auth.organizationId)
      .eq("id", advice.quote_id)
      .maybeSingle();
    quote = (data as BrokerQuoteRow | null) ?? null;
  } else {
    const { data } = await auth.adminSupabase
      .from("broker_quotes")
      .select("*")
      .eq("organization_id", auth.organizationId)
      .eq("client_id", clientId)
      .eq("extraction_status", "validated")
      .order("validated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    quote = (data as BrokerQuoteRow | null) ?? null;
  }

  const result = await generateAdviceContent(client as BrokerClientRow, quote);
  if (!result.success) {
    const status =
      result.reason === "ai_unconfigured"
        ? 503
        : result.reason === "no_quote"
          ? 422
          : 502;
    return jsonError(result.message, status, result.reason);
  }

  return NextResponse.json({
    success: true,
    motifs: result.motifs,
    requirements: result.requirements,
  });
}
