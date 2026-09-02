import { NextResponse, type NextRequest } from "next/server";
import { getActiveBrokerProfile } from "@/lib/broker/profiles";
import { requireBrokerApiContext } from "@/lib/broker/server";
import { sanitizeEmailHtml } from "@/lib/email/html";
import { getMailboxClient } from "@/lib/email/mailbox-resolver";

export const runtime = "nodejs";
export const maxDuration = 60;

export type MailboxMessageDetail = {
  id: string;
  /** Corps en texte : repli sûr et toujours présent. */
  body: string;
  /** Corps HTML ASSAINI, prêt à être rendu dans une iframe sandbox. */
  html: string | null;
  /** Images distantes neutralisées, que le courtier peut choisir d'afficher. */
  blockedImages: number;
  attachments: {
    id: string;
    name: string;
    contentType: string;
    size: number;
  }[];
};

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ message, reason }, { status });
}

/**
 * Le contenu complet d'un email, à la demande.
 *
 * Le HTML est renvoyé ASSAINI (voir lib/email/html.ts) : liste blanche de
 * balises, aucun script, images distantes neutralisées par défaut pour qu'ouvrir
 * un email ne signale pas sa lecture à l'expéditeur. Le client le rend dans une
 * iframe sandbox — deuxième barrière. `?images=1` rétablit les images quand le
 * courtier le demande explicitement.
 */
export async function GET(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return jsonError("Email manquant.", 400, "invalid_input");
  const allowRemoteImages = request.nextUrl.searchParams.get("images") === "1";

  const profile = await getActiveBrokerProfile(auth.organizationId);
  const mailbox = await getMailboxClient({
    organizationId: auth.organizationId,
    userId: auth.user.id,
    profileId: profile?.id ?? null,
    adminSupabase: auth.adminSupabase,
  });
  if (!mailbox) return jsonError("Boîte non connectée.", 409, "not_connected");

  try {
    const [body, attachments] = await Promise.all([
      mailbox.getBody(id),
      mailbox.listAttachments(id),
    ]);

    if (!body && attachments.length === 0) {
      return jsonError("Email introuvable dans la boîte.", 404, "not_found");
    }

    const sanitized = body?.html
      ? sanitizeEmailHtml(body.html, { allowRemoteImages })
      : null;

    const detail: MailboxMessageDetail = {
      id,
      body: body?.body ?? "",
      html: sanitized?.html ?? null,
      blockedImages: sanitized?.blockedImages ?? 0,
      attachments: attachments.map((a) => ({
        id: a.id,
        name: a.name,
        contentType: a.contentType,
        size: a.size,
      })),
    };
    return NextResponse.json(detail);
  } catch (error) {
    console.error("[mailbox] lecture du message impossible:", error);
    return jsonError(
      "Le contenu de cet email n’a pas pu être chargé.",
      502,
      "read_failed",
    );
  } finally {
    await mailbox.close();
  }
}
