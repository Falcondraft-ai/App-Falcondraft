import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateWebhookUrl } from "@/lib/security/validate-webhook-url";

interface TriggerParams {
  transcriptId: string;
  organizationId: string;
  audioStoragePath: string;
  language: string | null;
}

export async function triggerAudioTranscription(params: TriggerParams) {
  const { transcriptId, organizationId, audioStoragePath, language } = params;

  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) return;

  const n8nSecret = process.env.N8N_TRANSCRIPTION_SECRET;
  const callbackBaseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!n8nSecret || !callbackBaseUrl) return;

  const { data: workflowConfig } = await adminSupabase
    .from("system_workflow_configs")
    .select("n8n_webhook_url")
    .eq("workflow_type", "audio_transcription")
    .eq("status", "active")
    .maybeSingle();

  if (!workflowConfig) return;

  const { data: signedUrlData } = await adminSupabase.storage
    .from("transcripts-audio")
    .createSignedUrl(audioStoragePath, 3600);

  if (!signedUrlData?.signedUrl) return;

  const urlCheck = validateWebhookUrl(workflowConfig.n8n_webhook_url);
  if (!urlCheck.valid) {
    console.error("[trigger-transcription] SSRF blocked:", urlCheck.reason);
    return;
  }

  await fetch(workflowConfig.n8n_webhook_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-N8N-Secret": n8nSecret,
    },
    body: JSON.stringify({
      transcriptId,
      organizationId,
      audioUrl: signedUrlData.signedUrl,
      language,
      callbackUrl: `${callbackBaseUrl}/api/transcripts/callbacks`,
    }),
  }).catch(() => {});
}
