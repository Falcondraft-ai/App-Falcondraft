import { NextResponse, type NextRequest } from "next/server";
import { getActiveBrokerProfile } from "@/lib/broker/profiles";
import { requireBrokerApiContext } from "@/lib/broker/server";
import { getMailboxClient } from "@/lib/email/mailbox-resolver";

export const runtime = "nodejs";
export const maxDuration = 60;

export type MailboxMessageDetail = {
  id: string;
  body: string;
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
 * Le corps est rendu en TEXTE, pas en HTML : afficher le HTML d'un email
 * arbitraire dans l'application ouvrirait une porte à l'injection de script et
 * aux pixels de suivi. Le courtier lit le message, les pièces jointes restent
 * accessibles une par une.
 */
export async function GET(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return jsonError("Email manquant.", 400, "invalid_input");

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

    const detail: MailboxMessageDetail = {
      id,
      body: body?.body ?? "",
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
