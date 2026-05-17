import { NextResponse } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeWorkspaceRole } from "@/lib/auth/workspace-permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  { params }: RouteContext,
) {
  const { id } = await params;
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

  const { data: transcript } = await adminSupabase
    .from("transcripts")
    .select("id, organization_id, status, source, audio_storage_path, deal_id, language")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();

  if (!transcript) {
    return NextResponse.json({ error: "Transcript introuvable." }, { status: 404 });
  }

  if (transcript.source !== "audio_upload") {
    return NextResponse.json(
      { error: "Ce transcript ne provient pas d'un fichier audio." },
      { status: 400 },
    );
  }

  if (transcript.status !== "processing") {
    return NextResponse.json(
      { error: "Ce transcript n'est pas en attente de transcription." },
      { status: 409 },
    );
  }

  if (!transcript.audio_storage_path) {
    return NextResponse.json(
      { error: "Aucun fichier audio associé." },
      { status: 400 },
    );
  }

  const { data: workflowConfig } = await adminSupabase
    .from("system_workflow_configs")
    .select("n8n_webhook_url")
    .eq("workflow_type", "audio_transcription")
    .eq("status", "active")
    .maybeSingle();

  if (!workflowConfig) {
    return NextResponse.json(
      { error: "Configuration du workflow de transcription introuvable." },
      { status: 404 },
    );
  }

  const { data: signedUrlData, error: signedUrlError } = await adminSupabase.storage
    .from("transcripts-audio")
    .createSignedUrl(transcript.audio_storage_path, 3600);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return NextResponse.json(
      { error: "Impossible de générer le lien de téléchargement audio." },
      { status: 500 },
    );
  }

  const n8nSecret = process.env.N8N_TRANSCRIPTION_SECRET;
  if (!n8nSecret) {
    return NextResponse.json(
      { error: "Configuration de sécurité manquante." },
      { status: 500 },
    );
  }

  const callbackBaseUrl = process.env.NEXT_PUBLIC_APP_URL;

  const webhookBody = {
    transcriptId: transcript.id,
    organizationId,
    audioUrl: signedUrlData.signedUrl,
    language: transcript.language ?? null,
    callbackUrl: `${callbackBaseUrl}/api/transcripts/callbacks`,
  };

  const webhookResponse = await fetch(workflowConfig.n8n_webhook_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-N8N-Secret": n8nSecret,
    },
    body: JSON.stringify(webhookBody),
  }).catch(() => null);

  if (!webhookResponse?.ok) {
    return NextResponse.json(
      { error: "Le déclenchement de la transcription a échoué." },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true });
}
