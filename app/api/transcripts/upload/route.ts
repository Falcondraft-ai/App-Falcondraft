import { NextResponse } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeWorkspaceRole } from "@/lib/auth/workspace-permissions";
import { triggerAudioTranscription } from "@/lib/transcripts/trigger-transcription";

const ALLOWED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/webm",
]);

const ALLOWED_EXTENSIONS = new Set(["mp3", "wav", "m4a", "webm"]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export async function POST(request: Request) {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id;
  const role = normalizeWorkspaceRole(context.membership?.role);

  if (!organizationId || role === "viewer") {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const supabase = (await getSupabaseServerClient()) ?? getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim();
  const dealId = (formData.get("dealId") as string | null)?.trim() || null;
  const language = (formData.get("language") as string | null)?.trim() || null;

  if (!file || !title) {
    return NextResponse.json(
      { error: "Le fichier audio et le titre sont requis." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Le fichier dépasse la taille maximale de 100 Mo." },
      { status: 400 },
    );
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension) && !ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Format non supporté. Formats acceptés : mp3, wav, m4a, webm." },
      { status: 400 },
    );
  }

  const timestamp = Date.now();
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${organizationId}/${context.user.id}/${timestamp}_${safeFileName}`;

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("transcripts-audio")
    .upload(storagePath, fileBuffer, {
      contentType: file.type || "audio/mpeg",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Téléversement impossible: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const { data, error: insertError } = await supabase
    .from("transcripts")
    .insert({
      organization_id: organizationId,
      created_by: context.user.id,
      title,
      source: "audio_upload",
      status: "processing",
      audio_storage_path: storagePath,
      transcript_text: null,
      ...(dealId ? { deal_id: dealId } : {}),
      ...(language ? { language } : {}),
    })
    .select("id")
    .single();

  if (insertError) {
    await supabase.storage.from("transcripts-audio").remove([storagePath]);
    return NextResponse.json(
      { error: `Création du transcript impossible: ${insertError.message}` },
      { status: 500 },
    );
  }

  triggerAudioTranscription({
    transcriptId: data.id,
    organizationId,
    audioStoragePath: storagePath,
    language: language ?? null,
  }).catch(() => {});

  return NextResponse.json({ id: data.id }, { status: 201 });
}
