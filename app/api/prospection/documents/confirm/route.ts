import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canAccessProspection } from "@/lib/internal-access";
import { createProspectDocument } from "@/lib/prospection/data";

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

  const { companyId, fileName, filePath, mimeType, sizeBytes } = body as {
    companyId?: string;
    fileName?: string;
    filePath?: string;
    mimeType?: string;
    sizeBytes?: number;
  };

  if (!companyId || !fileName || !filePath) {
    return NextResponse.json(
      { success: false, message: "companyId, fileName et filePath requis." },
      { status: 400 },
    );
  }

  const doc = await createProspectDocument(organizationId, {
    company_id: companyId,
    uploaded_by: context.user.id,
    file_name: fileName,
    file_path: filePath,
    mime_type: mimeType ?? "application/pdf",
    size_bytes: sizeBytes ?? 0,
  });

  if (!doc) {
    return NextResponse.json(
      { success: false, message: "Impossible d'enregistrer le document." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, document: doc });
}
