import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { generateAdviceContent } from "@/lib/broker/advice-ai";
import { buildAdviceJustificationDraft } from "@/lib/broker/advice-document";
import {
  logBrokerActivity,
  requireBrokerApiContext,
} from "@/lib/broker/server";
import type { BrokerClientRow, BrokerQuoteRow } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  // A dossier holds a single devoir de conseil. To redo one, the broker must
  // delete the existing document first (avoids duplicates / ambiguity).
  const { data: existingAdvice } = await auth.adminSupabase
    .from("broker_advice")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .limit(1)
    .maybeSingle();
  if (existingAdvice) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Un devoir de conseil existe déjà pour ce dossier. Supprimez-le pour en générer un nouveau.",
        reason: "advice_exists",
        adviceId: existingAdvice.id,
      },
      { status: 409 },
    );
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

  // Template mode: let the AI write the justification from ALL the recorded info
  // (client notes + the validated quote), keeping only what's pertinent. Falls
  // back to the editable scaffold if the AI is unavailable or there's no quote.
  let content = "";
  let requirements: string | null = null;
  if (values.mode === "template") {
    content = buildAdviceJustificationDraft();
    if (quote) {
      const ai = await generateAdviceContent(client as BrokerClientRow, quote);
      if (ai.success) {
        if (ai.motifs.trim()) content = ai.motifs;
        if (ai.requirements.trim()) requirements = ai.requirements;
      }
    }
  }

  const now = new Date().toISOString();
  const { data: advice, error } = await auth.adminSupabase
    .from("broker_advice")
    .insert({
      organization_id: auth.organizationId,
      client_id: clientId,
      quote_id: quote?.id ?? null,
      // Le devoir de conseil engage une personne : on retient laquelle.
      profile_id: auth.profileId,
      created_by: auth.user.id,
      title: "Devoir de conseil",
      content,
      requirements,
      // Draft first: the broker reviews and adjusts the AI-written content,
      // validates it, and only then can produce the PDF and the signature link.
      status: "draft",
      generated_at: now,
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
    profileId: auth.profileId,
    type: "advice_created",
    description: "Devoir de conseil généré — contenu à relire et valider.",
    metadata: { advice_id: advice.id },
  });

  // The dossier only becomes "advice_ready" once the broker validates the
  // content (PATCH with validate: true) — not at generation time.

  return NextResponse.json({ success: true, adviceId: advice.id });
}
