import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getDealsForOrganization } from "@/lib/data/supabase-app-data";

export type SearchResult = {
  id: string;
  type: "deal";
  href: string;
  title: string;
  subtitle: string;
  status: string;
};

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] satisfies SearchResult[] });
  }

  try {
    const context = await requireCurrentUserContext();
    const organizationId = context.organization?.id ?? null;

    if (!organizationId) {
      return NextResponse.json({ results: [] });
    }

    const access = {
      userId: context.user.id,
      role: context.membership?.role,
      allowMemberCompanyVisibility:
        context.organization?.allow_member_company_visibility ?? true,
      scope: "organization" as const,
    };

    const deals = await getDealsForOrganization(organizationId, { access });
    const needle = q.toLowerCase();

    const results: SearchResult[] = deals
      .filter((deal) => {
        const haystack = [
          deal.name,
          deal.clientCompanyName,
          deal.clientContactName,
          deal.clientEmail,
          deal.proposalTitle,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 8)
      .map((deal) => ({
        id: deal.id,
        type: "deal" as const,
        href: `/dashboard/deals/${deal.id}`,
        title: deal.clientCompanyName || deal.name,
        subtitle: deal.name,
        status: deal.status,
      }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[search] failed:", error);
    return NextResponse.json(
      { results: [], error: "search_failed" },
      { status: 500 },
    );
  }
}
