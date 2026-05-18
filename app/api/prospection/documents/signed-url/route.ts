import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canAccessProspection, canManageProspection } from "@/lib/internal-access";
import {
  getProspectDocumentById,
  getProspectDocumentSignedUrl,
} from "@/lib/prospection/data";

export async function POST(request: NextRequest) {
  const context = await requireCurrentUserContext();

  if (!canAccessProspection(context)) {
    return NextResponse.json(
      { success: false, message: "Accès non autorisé." },
      { status: 403 },
    );
  }

  const organizationId = context.organization?.id;
  if (!organizationId) {
    return NextResponse.json(
      { success: false, message: "Aucune organisation active." },
      { status: 400 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, message: "Requête invalide." },
      { status: 400 },
    );
  }

  const { documentId } = body as { documentId?: string };

  if (!documentId) {
    return NextResponse.json(
      { success: false, message: "documentId requis." },
      { status: 400 },
    );
  }

  const doc = await getProspectDocumentById(documentId, organizationId);
  if (!doc) {
    return NextResponse.json(
      { success: false, message: "Document introuvable." },
      { status: 404 },
    );
  }

  const isManager = canManageProspection(context);

  if (!isManager && doc.uploaded_by !== context.user.id) {
    return NextResponse.json(
      { success: false, message: "Vous ne pouvez pas accéder à ce document." },
      { status: 403 },
    );
  }

  const signedUrl = await getProspectDocumentSignedUrl(doc.file_path);
  if (!signedUrl) {
    return NextResponse.json(
      { success: false, message: "Impossible de générer l'URL signée." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, signedUrl });
}
