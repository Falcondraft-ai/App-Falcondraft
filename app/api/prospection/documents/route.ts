import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canAccessProspection, canManageProspection } from "@/lib/internal-access";
import {
  archiveProspectDocument,
  permanentlyDeleteProspectDocument,
} from "@/lib/prospection/data";

export async function PATCH(request: NextRequest) {
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

  const isManager = canManageProspection(context);
  const archived = await archiveProspectDocument(
    documentId,
    organizationId,
    context.user.id,
    isManager,
  );

  if (!archived) {
    return NextResponse.json(
      { success: false, message: "Impossible d'archiver le document." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const context = await requireCurrentUserContext();

  if (!canManageProspection(context)) {
    return NextResponse.json(
      { success: false, message: "Accès réservé aux gestionnaires." },
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

  const deleted = await permanentlyDeleteProspectDocument(documentId, organizationId);

  if (!deleted) {
    return NextResponse.json(
      { success: false, message: "Impossible de supprimer le document." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
