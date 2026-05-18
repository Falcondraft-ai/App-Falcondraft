import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canAccessProspection } from "@/lib/internal-access";
import { getProspectingSearchById } from "@/lib/prospection/data";
import {
  importSingleSearchResult,
  importSelectedSearchResults,
  importAllValidSearchResults,
} from "@/lib/prospection/data";

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

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, message: "Requête invalide." },
      { status: 400 },
    );
  }

  const { action, resultId } = body as {
    action?: string;
    resultId?: string;
  };

  if (action === "import_single") {
    if (!resultId) {
      return NextResponse.json(
        { success: false, message: "resultId requis pour import_single." },
        { status: 400 },
      );
    }
    const ok = await importSingleSearchResult(resultId, organizationId);
    return NextResponse.json({ success: ok, imported: ok ? 1 : 0, failed: ok ? 0 : 1 });
  }

  if (action === "import_selected") {
    const { imported, failed } = await importSelectedSearchResults(
      searchId,
      organizationId,
    );
    return NextResponse.json({ success: true, imported, failed });
  }

  if (action === "import_all") {
    const { imported, failed } = await importAllValidSearchResults(
      searchId,
      organizationId,
    );
    return NextResponse.json({ success: true, imported, failed });
  }

  return NextResponse.json(
    { success: false, message: "Action inconnue." },
    { status: 400 },
  );
}
