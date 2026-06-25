import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { buildAdviceTemplate } from "@/lib/broker/advice";
import { logBrokerActivity, requireBrokerApiContext } from "@/lib/broker/server";
import type { BrokerClientRow, BrokerQuoteRow } from "@/types/database";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  mode: z.enum(["template", "blank"]).default("template"),
  quoteId: z.string().uuid().optional().nullable(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas de créer un devoir de conseil.",
      403,
      "insufficient_role",
    );
  }

  const { id: clientId } = await ctx.params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Requête invalide.", 400, "invalid_payload");
  }
  const values = parsed.data;

  const { data: client } = await auth.adminSupabase
    .from("broker_clients")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return jsonError("Dossier introuvable.", 404, "client_not_found");
  }

  // Resolve the quote to base the template on: the requested one, else the most
  // recent validated quote for this client.
  let quote: BrokerQuoteRow | null = null;
  if (values.mode === "template") {
    if (values.quoteId) {
      const { data } = await auth.adminSupabase
        .from("broker_quotes")
        .select("*")
        .eq("organization_id", auth.organizationId)
        .eq("client_id", clientId)
        .eq("id", values.quoteId)
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
  }

  const content =
    values.mode === "template"
      ? buildAdviceTemplate(client as BrokerClientRow, quote)
      : "";

  const now = new Date().toISOString();
  const { data: advice, error } = await auth.adminSupabase
    .from("broker_advice")
    .insert({
      organization_id: auth.organizationId,
      client_id: clientId,
      quote_id: quote?.id ?? null,
      created_by: auth.user.id,
      title: "Devoir de conseil",
      content,
      status: "draft",
      generated_at: values.mode === "template" ? now : null,
    })
    .select("id")
    .single();

  if (error || !advice) {
    return jsonError(
      "Création du devoir de conseil impossible.",
      500,
      error?.message ?? "insert_failed",
    );
  }

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    type: "advice_created",
    description:
      values.mode === "template"
        ? "Devoir de conseil généré (brouillon à compléter)."
        : "Devoir de conseil créé (vierge).",
    metadata: { advice_id: advice.id },
  });

  return NextResponse.json({ success: true, adviceId: advice.id });
}
