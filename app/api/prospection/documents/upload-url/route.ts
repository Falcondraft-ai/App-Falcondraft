import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canAccessProspection } from "@/lib/internal-access";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_SIZE = 20 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase();
}

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

  const { companyId, fileName, mimeType, sizeBytes } = body as {
    companyId?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
  };

  if (!companyId || !fileName || !mimeType) {
    return NextResponse.json(
      { success: false, message: "companyId, fileName et mimeType requis." },
      { status: 400 },
    );
  }

  if (mimeType !== "application/pdf") {
    return NextResponse.json(
      { success: false, message: "Seuls les fichiers PDF sont acceptés." },
      { status: 400 },
    );
  }

  if (sizeBytes && sizeBytes > MAX_SIZE) {
    return NextResponse.json(
      { success: false, message: "Fichier trop volumineux (max 20 MB)." },
      { status: 400 },
    );
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { success: false, message: "Configuration stockage indisponible." },
      { status: 500 },
    );
  }

  const timestamp = Date.now();
  const safeName = sanitizeFileName(fileName.replace(/\.pdf$/i, ""));
  const storagePath = `${context.user.id}/${companyId}/${timestamp}-${safeName}.pdf`;

  const { data, error } = await adminClient.storage
    .from("prospection-documents")
    .createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { success: false, message: "Impossible de générer l'URL d'upload." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    signedUrl: data.signedUrl,
    filePath: storagePath,
  });
}
