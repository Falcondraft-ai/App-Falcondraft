import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const secret = process.env.N8N_TRANSCRIPTION_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Non configuré." }, { status: 500 });
  }

  const authHeader = request.headers.get("x-n8n-secret");
  if (!authHeader || authHeader !== secret) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.transcriptId) {
    return NextResponse.json(
      { error: "transcriptId requis." },
      { status: 400 },
    );
  }

  const { transcriptId, errorMessage } = body as {
    transcriptId: string;
    errorMessage?: string;
  };

  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  const { data: transcript, error: fetchError } = await adminSupabase
    .from("transcripts")
    .select("id, status")
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
      status: "error",
      error_message: errorMessage || "La transcription a échoué.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", transcriptId);

  if (updateError) {
    return NextResponse.json({ error: "Mise à jour impossible." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
