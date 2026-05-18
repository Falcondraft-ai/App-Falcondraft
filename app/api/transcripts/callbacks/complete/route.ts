import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function isValidSecret(requestSecret: string, configuredSecret: string) {
  if (!requestSecret || !configuredSecret) return false;
  const a = Buffer.from(requestSecret);
  const b = Buffer.from(configuredSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.N8N_TRANSCRIPTION_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Non configuré." }, { status: 500 });
  }

  const authHeader = request.headers.get("x-n8n-secret");
  if (!isValidSecret(authHeader ?? "", secret)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.transcriptId || !body?.transcriptText) {
    return NextResponse.json(
      { error: "transcriptId et transcriptText requis." },
      { status: 400 },
    );
  }

  const { transcriptId, transcriptText } = body as {
    transcriptId: string;
    transcriptText: string;
  };

  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  const { data: transcript, error: fetchError } = await adminSupabase
    .from("transcripts")
    .select("id, organization_id, deal_id, status")
    .eq("id", transcriptId)
    .single();

  if (fetchError || !transcript) {
    return NextResponse.json({ error: "Transcript introuvable." }, { status: 404 });
  }

  if (transcript.status !== "processing") {
    return NextResponse.json(
      { error: "Transcript non en attente." },
      { status: 409 },
    );
  }

  const { error: updateError } = await adminSupabase
    .from("transcripts")
    .update({
      status: "ready",
      transcript_text: transcriptText,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transcriptId);

  if (updateError) {
    return NextResponse.json({ error: "Mise à jour impossible." }, { status: 500 });
  }

  if (transcript.deal_id) {
    await adminSupabase
      .from("deals")
      .update({
        transcript: transcriptText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transcript.deal_id)
      .eq("organization_id", transcript.organization_id);
  }

  return NextResponse.json({ success: true });
}
