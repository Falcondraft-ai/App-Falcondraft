import { NextResponse, type NextRequest } from "next/server";
import { requireBrokerApiContext } from "@/lib/broker/server";
import {
  getFileAttachmentBytes,
  getOutlookAccessForUser,
} from "@/lib/email/outlook-read";
import type { BrokerEmailSuggestionRow } from "@/types/database";

type RouteContext = { params: Promise<{ suggestionId: string }> };

/**
 * Types we accept to render INLINE in the briefing. Everything else is forced
 * to download: an attachment is attacker-controlled content, and serving e.g.
 * HTML or SVG inline from our own origin would run as same-origin script.
 */
const inlineContentTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

function str(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Streams an email attachment straight from Outlook so the broker can look at
 * a document before deciding which dossier it belongs to. Nothing is stored:
 * the file only lands in the GED once the action is accepted.
 */
export async function GET(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const { suggestionId } = await ctx.params;

  const { data } = await auth.adminSupabase
    .from("broker_email_suggestions")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .eq("user_id", auth.user.id)
    .eq("id", suggestionId)
    .maybeSingle();

  const suggestion = data as BrokerEmailSuggestionRow | null;
  if (!suggestion || suggestion.type !== "attach_document") {
    return jsonError("Pièce jointe introuvable.", 404, "not_found");
  }

  const payload = suggestion.payload ?? {};
  const messageId = str(payload, "graph_message_id");
  const attachmentId = str(payload, "graph_attachment_id");
  if (!messageId || !attachmentId) {
    return jsonError("Pièce jointe introuvable.", 404, "missing_reference");
  }

  const access = await getOutlookAccessForUser(
    auth.organizationId,
    auth.user.id,
  );
  if (!access) {
    return jsonError("Connexion Outlook indisponible.", 409, "not_connected");
  }

  const file = await getFileAttachmentBytes(
    access.accessToken,
    messageId,
    attachmentId,
  );
  if (!file) {
    return jsonError("Pièce jointe indisponible.", 502, "download_failed");
  }

  const contentType = (file.contentType || "")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  const inline = inlineContentTypes.has(contentType);
  const fileName = (str(payload, "file_name") ?? file.name).replace(
    /["\\\r\n]/g,
    "",
  );

  return new NextResponse(new Uint8Array(Buffer.from(file.contentBase64, "base64")), {
    headers: {
      "Content-Type": inline ? contentType : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName}"`,
      // The browser must not second-guess the type we just allow-listed.
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
