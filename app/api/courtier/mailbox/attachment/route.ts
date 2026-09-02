import { NextResponse, type NextRequest } from "next/server";
import { getActiveBrokerProfile } from "@/lib/broker/profiles";
import { requireBrokerApiContext } from "@/lib/broker/server";
import { getMailboxClient } from "@/lib/email/mailbox-resolver";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Sert une pièce jointe depuis la boîte, sans l'archiver.
 *
 * Consultation seulement : ranger une pièce dans un dossier reste une action
 * explicite du courtier, via le briefing ou la GED. Le fichier est renvoyé en
 * pièce à télécharger (`attachment`) et non affiché en ligne — un HTML ou un
 * SVG rendu dans l'origine de l'application pourrait exécuter du script.
 */
export async function GET(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const params = request.nextUrl.searchParams;
  const messageId = params.get("id")?.trim();
  const attachmentId = params.get("attachment")?.trim();
  if (!messageId || !attachmentId) {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const profile = await getActiveBrokerProfile(auth.organizationId);
  const mailbox = await getMailboxClient({
    organizationId: auth.organizationId,
    userId: auth.user.id,
    profileId: profile?.id ?? null,
    adminSupabase: auth.adminSupabase,
  });
  if (!mailbox) {
    return NextResponse.json({ message: "Boîte non connectée." }, { status: 409 });
  }

  try {
    const file = await mailbox.getAttachmentBytes(messageId, attachmentId);
    if (!file) {
      return NextResponse.json(
        { message: "Pièce jointe introuvable." },
        { status: 404 },
      );
    }

    const bytes = Buffer.from(file.contentBase64, "base64");
    // Le nom de fichier vient de l'email : il est nettoyé avant d'entrer dans
    // un en-tête HTTP, où un retour à la ligne permettrait d'en injecter un autre.
    const safeName = file.name.replace(/[^\w .()\-À-ÿ]/g, "_").slice(0, 120);

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[mailbox] pièce jointe illisible:", error);
    return NextResponse.json(
      { message: "La pièce jointe n’a pas pu être chargée." },
      { status: 502 },
    );
  } finally {
    await mailbox.close();
  }
}
