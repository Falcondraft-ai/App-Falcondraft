import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { isBrokerWorkspace } from "@/lib/broker/access";
import {
  brokerClientDisplayName,
  insuranceTypeLabel,
} from "@/lib/broker/clients";
import { getBrokerClients } from "@/lib/broker/data";

export type BrokerSearchResult = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  status: string;
};

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] satisfies BrokerSearchResult[] });
  }

  try {
    const context = await requireCurrentUserContext();
    const organizationId = context.organization?.id ?? null;

    if (!organizationId || !isBrokerWorkspace(context.organization)) {
      return NextResponse.json({ results: [] });
    }

    const clients = await getBrokerClients(organizationId, {
      search: q,
      limit: 8,
    });

    const results: BrokerSearchResult[] = clients.map((client) => {
      const branch = insuranceTypeLabel(client.insurance_type);
      const subtitle = [client.email, branch !== "—" ? branch : null]
        .filter(Boolean)
        .join(" · ");
      return {
        id: client.id,
        href: `/courtier/clients/${client.id}`,
        title: brokerClientDisplayName(client),
        subtitle: subtitle || "Dossier client",
        status: client.status,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[broker-search] failed:", error);
    return NextResponse.json(
      { results: [], error: "search_failed" },
      { status: 500 },
    );
  }
}
