import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeWorkspaceRole } from "@/lib/auth/workspace-permissions";

const MEETING_URL_REGEX =
  /^https:\/\/([a-z0-9-]+\.)?(meet\.google\.com\/|zoom\.us\/(j|wc\/join)\/|teams\.(microsoft|live)\.com\/l\/(meetup-join|meet)\/)/;

const requestSchema = z.object({
  title: z.string().min(3).max(200),
  meetingUrl: z.string().url().regex(MEETING_URL_REGEX, "URL de réunion non supportée."),
  dealId: z.string().uuid().nullable().optional(),
  language: z.string().max(10).nullable().optional(),
});

export async function POST(request: Request) {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id;
  const role = normalizeWorkspaceRole(context.membership?.role);

  if (!organizationId || role === "viewer") {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Données invalides.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { title, meetingUrl, dealId, language } = parsed.data;

  if (dealId) {
    const { data: deal } = await adminSupabase
      .from("deals")
      .select("id")
      .eq("id", dealId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!deal) {
      return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
    }
  }

  const recallApiKey = process.env.RECALL_API_KEY;
  if (!recallApiKey) {
    console.error("[Recall] RECALL_API_KEY is not set");
    return NextResponse.json(
      { error: "Configuration Recall.ai manquante." },
      { status: 500 },
    );
  }

  const recallBaseUrl = process.env.RECALL_API_BASE_URL || "https://api.recall.ai";

  const recallResponse = await fetch(`${recallBaseUrl}/api/v1/bot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${recallApiKey}`,
    },
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: "FalconDraft",
    }),
  }).catch((err: unknown) => {
    console.error("[Recall] Fetch failed:", err instanceof Error ? err.message : err);
    return null;
  });

  if (!recallResponse?.ok) {
    const status = recallResponse?.status ?? "no response";
    console.error(`[Recall] Bot creation failed — status: ${status}`);
    return NextResponse.json(
      { error: "Impossible de créer le bot Recall.ai." },
      { status: 502 },
    );
  }

  const recallData = (await recallResponse.json()) as {
    id?: string;
    [key: string]: unknown;
  };

  if (!recallData.id) {
    return NextResponse.json(
      { error: "Réponse Recall.ai invalide." },
      { status: 502 },
    );
  }

  const { data: transcript, error: insertError } = await adminSupabase
    .from("transcripts")
    .insert({
      organization_id: organizationId,
      created_by: context.user.id,
      title,
      source: "recall_ai",
      status: "waiting",
      recall_bot_id: recallData.id,
      recall_meeting_url: meetingUrl,
      transcript_text: null,
      ...(dealId ? { deal_id: dealId } : {}),
      ...(language ? { language } : {}),
    })
    .select("id")
    .single();

  if (insertError || !transcript) {
    return NextResponse.json(
      { error: "Création du transcript impossible." },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: transcript.id }, { status: 201 });
}
