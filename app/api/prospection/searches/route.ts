import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canAccessProspection } from "@/lib/internal-access";
import {
  createProspectingSearch,
  updateSearchLastRunAt,
} from "@/lib/prospection/data";
import {
  triggerProspectionSearch,
} from "@/lib/prospection/n8n";

const nicheOptions = ["Falcon Conseil", "Falcon Event", "Falcon Assurance", "Falcon Immo", "Autre"] as const;
const scopeOptions = ["city", "region", "country"] as const;
const maxResultsOptions = [10, 20, 50, 100] as const;

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

  const {
    niche,
    scope_type: scopeType,
    location_query: locationQuery,
    max_results: maxResults,
    include_keywords: includeKeywords,
    exclude_keywords: excludeKeywords,
    auto_launch: autoLaunch,
  } = body as {
    niche?: string;
    scope_type?: string;
    location_query?: string;
    max_results?: number;
    include_keywords?: string;
    exclude_keywords?: string;
    auto_launch?: boolean;
  };

  if (!niche || !nicheOptions.includes(niche as (typeof nicheOptions)[number])) {
    return NextResponse.json(
      { success: false, message: "Niche invalide." },
      { status: 400 },
    );
  }

  if (!scopeType || !scopeOptions.includes(scopeType as (typeof scopeOptions)[number])) {
    return NextResponse.json(
      { success: false, message: "Périmètre invalide." },
      { status: 400 },
    );
  }

  if (!locationQuery || !locationQuery.trim()) {
    return NextResponse.json(
      { success: false, message: "Localisation requise." },
      { status: 400 },
    );
  }

  if (niche === "Autre" && (!includeKeywords || !includeKeywords.trim())) {
    return NextResponse.json(
      { success: false, message: "Des mots-clés à inclure sont requis pour la niche Autre." },
      { status: 400 },
    );
  }

  const validMaxResults = (maxResultsOptions as readonly number[]).includes(
    maxResults ?? 0,
  )
    ? (maxResults as number)
    : 50;

  const scopeLabel =
    scopeType === "city"
      ? "Ville"
      : scopeType === "region"
        ? "Région"
        : "Pays";

  const name = `${niche} ${locationQuery.trim()} (${scopeLabel})`;

  const search = await createProspectingSearch(organizationId, {
    name,
    niche,
    category_query: "Tout",
    scope_type: scopeType,
    location_query: locationQuery.trim(),
    max_results: validMaxResults,
    include_keywords: includeKeywords?.trim() || null,
    exclude_keywords: excludeKeywords?.trim() || null,
  });

  if (!search) {
    return NextResponse.json(
      { success: false, message: "Création de la recherche échouée." },
      { status: 500 },
    );
  }

  let launchMessage = "";
  let launchSuccess = false;

  if (autoLaunch) {
    const n8nResult = await triggerProspectionSearch(search.id);
    launchSuccess = n8nResult.success;
    launchMessage = n8nResult.message;

    if (launchSuccess) {
      await updateSearchLastRunAt(search.id, organizationId);
    }
  }

  return NextResponse.json({
    success: true,
    search,
    launch: autoLaunch
      ? { success: launchSuccess, message: launchMessage }
      : null,
  });
}
