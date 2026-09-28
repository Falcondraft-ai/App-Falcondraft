import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { BROKER_FILES_BUCKET, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/broker/documents";
import {
  adjustOrganizationStorage,
  logBrokerActivity,
  requireBrokerApiContext,
} from "@/lib/broker/server";
import {
  EMAIL_FILE_MIME,
  emailFileKind,
  parseEmailFile,
  type ParsedEmailFile,
} from "@/lib/email/email-file";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

// The file itself was uploaded straight to Storage through a signed URL (same
// path as any GED document — a function request body caps at a few MB, an email
// with its attachments easily weighs more). This step reads it back, checks it
// is really an email, and files it: in the GED, and in the dossier's emails.
const schema = z.object({
  path: z.string().trim().min(1).max(600),
  fileName: z.string().trim().min(1).max(255),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/** First lines of the body, as the preview shown in the dossier's email list. */
function preview(email: ParsedEmailFile): string | null {
  const text = email.text.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 280) : null;
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Votre rôle ne permet pas d’ajouter des emails.", 403, "insufficient_role");
  }

  const { id: clientId } = await ctx.params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Requête invalide.", 400, "invalid_payload");
  const { path, fileName } = parsed.data;

  // Only a file this dossier's upload URL could have produced.
  if (!path.startsWith(`${auth.organizationId}/${clientId}/`) || path.includes("..")) {
    return jsonError("Chemin de fichier invalide.", 400, "invalid_path");
  }

  const { data: client } = await auth.adminSupabase
    .from("broker_clients")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return jsonError("Dossier introuvable.", 404, "client_not_found");

  const removeUpload = () =>
    auth.adminSupabase.storage.from(BROKER_FILES_BUCKET).remove([path]);

  const { data: file } = await auth.adminSupabase.storage
    .from(BROKER_FILES_BUCKET)
    .download(path);
  if (!file) return jsonError("Fichier introuvable.", 404, "file_not_found");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX_DOCUMENT_SIZE_BYTES) {
    await removeUpload();
    return jsonError("Fichier trop volumineux.", 413, "file_too_large");
  }

  const kind = emailFileKind(fileName, bytes);
  let email: ParsedEmailFile | null = null;
  if (kind) {
    email = await parseEmailFile(bytes, kind).catch((error: unknown) => {
      console.error("[broker] email file unreadable:", error);
      return null;
    });
  }
  if (!kind || !email) {
    await removeUpload();
    return jsonError(
      "Ce fichier n’est pas un email lisible. Glissez un message depuis Outlook (.msg) ou un fichier .eml.",
      415,
      "not_an_email",
    );
  }

  // Sent or received, from the cabinet's point of view.
  const [{ data: profiles }, { data: connections }] = await Promise.all([
    auth.adminSupabase
      .from("broker_profiles")
      .select("email")
      .eq("organization_id", auth.organizationId),
    auth.adminSupabase
      .from("email_connections")
      .select("email")
      .eq("organization_id", auth.organizationId),
  ]);
  const cabinet = new Set(
    [...(profiles ?? []), ...(connections ?? [])]
      .map((row) => row.email?.trim().toLowerCase())
      .filter((a): a is string => Boolean(a)),
  );
  const sent = Boolean(email.fromEmail && cabinet.has(email.fromEmail));

  const { data: document, error: documentError } = await auth.adminSupabase
    .from("broker_documents")
    .insert({
      organization_id: auth.organizationId,
      client_id: clientId,
      uploaded_by: auth.user.id,
      category: "other",
      title: `Email — ${email.subject}`.slice(0, 200),
      file_name: fileName,
      storage_path: path,
      mime_type: EMAIL_FILE_MIME[kind],
      size_bytes: bytes.byteLength,
      status: "stored",
    })
    .select("id")
    .single();
  if (documentError || !document) {
    await removeUpload();
    return jsonError("Enregistrement impossible.", 500, "document_insert_failed");
  }

  const { error: itemError } = await auth.adminSupabase.from("broker_email_items").insert({
    organization_id: auth.organizationId,
    digest_id: null,
    user_id: auth.user.id,
    profile_id: auth.profileId,
    // The real Message-ID when the file has one: the same email later found in a
    // mailbox is then recognised instead of showing twice.
    graph_message_id: email.messageId ?? `file:${document.id}`,
    from_name: email.fromName || null,
    from_email: email.fromEmail || null,
    subject: email.subject,
    received_at: email.date,
    summary: preview(email),
    relevance: "relevant",
    suggested_client_id: clientId,
    has_attachments: email.attachments.length > 0,
    status: "reviewed",
    direction: sent ? "sent" : "received",
    to_emails: email.recipients,
    document_id: document.id,
    updated_at: new Date().toISOString(),
  });

  if (itemError) {
    await auth.adminSupabase.from("broker_documents").delete().eq("id", document.id);
    await removeUpload();
    // 23505: this very email is already filed (same Message-ID).
    return itemError.code === "23505"
      ? jsonError("Cet email est déjà rangé dans un dossier.", 409, "already_filed")
      : jsonError("Enregistrement impossible.", 500, "email_insert_failed");
  }

  await adjustOrganizationStorage(auth.adminSupabase, auth.organizationId, bytes.byteLength);
  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    profileId: auth.profileId,
    type: "email_linked",
    description: `Email ajouté au dossier : « ${email.subject} ».`,
    metadata: { document_id: document.id, direction: sent ? "sent" : "received" },
  });

  return NextResponse.json({ success: true, subject: email.subject });
}
