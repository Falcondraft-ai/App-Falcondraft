import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canAccessProspection } from "@/lib/internal-access";
import { getProspectingSearchById, updateSearchLastRunAt } from "@/lib/prospection/data";
import { triggerProspectionSearch } from "@/lib/prospection/n8n";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id: searchId } = await params;

  const search = await getProspectingSearchById(searchId, organizationId);
  if (!search) {
    return NextResponse.json(
      { success: false, message: "Recherche introuvable." },
      { status: 404 },
    );
  }

  const result = await triggerProspectionSearch(searchId);

  if (result.success) {
    await updateSearchLastRunAt(searchId, organizationId);
  }

  return NextResponse.json(result);
}
