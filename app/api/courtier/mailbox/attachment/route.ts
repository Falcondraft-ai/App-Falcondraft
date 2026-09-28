import { NextResponse, type NextRequest } from "next/server";
import { loadFiledEmail, openEmailMailbox } from "@/lib/broker/email-source";
import { requireBrokerApiContext } from "@/lib/broker/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function fileResponse(name: string, contentType: string, bytes: Buffer) {
  // Le nom de fichier vient de l'email : il est nettoyé avant d'entrer dans
  // un en-tête HTTP, où un retour à la ligne permettrait d'en injecter un autre.
  const safeName = name.replace(/[^\w .()\-À-ÿ]/g, "_").slice(0, 120);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}

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

  // Pièce jointe d'un email déposé en fichier : relue depuis la GED.
  const documentId = params.get("document")?.trim();
  if (documentId) {
    const filed = await loadFiledEmail(auth, documentId);
    const attachment = filed?.attachments[Number(attachmentId)];
    if (!attachment) {
      return NextResponse.json({ message: "Pièce jointe introuvable." }, { status: 404 });
    }
    return fileResponse(attachment.name, attachment.contentType, attachment.content);
  }

  const mailbox = await openEmailMailbox(auth, params.get("profile"));
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

    return fileResponse(
      file.name,
      file.contentType,
      Buffer.from(file.contentBase64, "base64"),
    );
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
