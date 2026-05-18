import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canAccessProspection } from "@/lib/internal-access";
import {
  getProspectSearchResults,
  getProspectingSearchById,
  updateSearchResultReviewStatus,
} from "@/lib/prospection/data";

export async function GET(
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

  const results = await getProspectSearchResults(searchId, organizationId);

  return NextResponse.json({ success: true, results });
}

export async function PATCH(
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

  const { resultId, review_status: reviewStatus } = body as {
    resultId?: string;
    review_status?: string;
  };

  if (!resultId || !reviewStatus) {
    return NextResponse.json(
      { success: false, message: "resultId et review_status requis." },
      { status: 400 },
    );
  }

  if (!["pending_review", "selected", "ignored"].includes(reviewStatus)) {
    return NextResponse.json(
      { success: false, message: "review_status invalide." },
      { status: 400 },
    );
  }

  const ok = await updateSearchResultReviewStatus(
    resultId,
    organizationId,
    reviewStatus as "pending_review" | "selected" | "ignored",
  );

  return NextResponse.json({ success: ok });
}
