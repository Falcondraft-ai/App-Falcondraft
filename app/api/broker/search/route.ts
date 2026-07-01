import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { isBrokerWorkspace } from "@/lib/broker/access";
import {
  brokerClientDisplayName,
  insuranceTypeLabel,
} from "@/lib/broker/clients";
import { getBrokerClients } from "@/lib/broker/data";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BrokerClientRow } from "@/types/database";

export type BrokerSearchType = "client" | "contract" | "document";

export type BrokerSearchResult = {
  id: string;
  type: BrokerSearchType;
  href: string;
  title: string;
  subtitle: string;
  status?: string;
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

    const admin = getSupabaseAdminClient();
    const like = `%${q}%`;

    // Clients (name, email, phone, address, city, postal code, company).
    const clientsPromise = getBrokerClients(organizationId, {
      search: q,
      limit: 6,
    });

    // Contracts (insurer = compagnie, product, policy number / RIB-like refs).
    const contractsPromise = admin
      ? admin
          .from("broker_contracts")
          .select(
            "id, client_id, insurer_name, product_name, policy_number, status",
          )
          .eq("organization_id", organizationId)
          .or(
            `insurer_name.ilike.${like},product_name.ilike.${like},policy_number.ilike.${like}`,
          )
          .limit(5)
      : Promise.resolve({ data: [] });

    // Documents (title, file name — covers "RIB", attestations, etc.).
    const documentsPromise = admin
      ? admin
          .from("broker_documents")
          .select("id, client_id, title, file_name, category")
          .eq("organization_id", organizationId)
          .or(`title.ilike.${like},file_name.ilike.${like}`)
          .limit(5)
      : Promise.resolve({ data: [] });

    const [clients, contractsRes, documentsRes] = await Promise.all([
      clientsPromise,
      contractsPromise,
      documentsPromise,
    ]);

    const contracts = (contractsRes.data ?? []) as {
      id: string;
      client_id: string;
      insurer_name: string | null;
      product_name: string | null;
      policy_number: string | null;
      status: string;
    }[];
    const documents = (documentsRes.data ?? []) as {
      id: string;
      client_id: string;
      title: string;
      file_name: string;
      category: string;
    }[];

    // Resolve client names for contract/document subtitles in one query.
    const extraClientIds = [
      ...new Set([
        ...contracts.map((c) => c.client_id),
        ...documents.map((d) => d.client_id),
      ]),
    ];
    const namesById = new Map<string, string>();
    for (const c of clients) namesById.set(c.id, brokerClientDisplayName(c));
    const missing = extraClientIds.filter((id) => !namesById.has(id));
    if (admin && missing.length > 0) {
      const { data } = await admin
        .from("broker_clients")
        .select("*")
        .eq("organization_id", organizationId)
        .in("id", missing);
      for (const row of (data ?? []) as BrokerClientRow[]) {
        namesById.set(row.id, brokerClientDisplayName(row));
      }
    }

    const results: BrokerSearchResult[] = [];

    for (const client of clients) {
      const branch = insuranceTypeLabel(client.insurance_type);
      const subtitle = [client.email, branch !== "—" ? branch : null]
        .filter(Boolean)
        .join(" · ");
      results.push({
        id: `client-${client.id}`,
        type: "client",
        href: `/courtier/clients/${client.id}`,
        title: brokerClientDisplayName(client),
        subtitle: subtitle || "Dossier client",
        status: client.status,
      });
    }

    for (const contract of contracts) {
      const clientName = namesById.get(contract.client_id) ?? "Client";
      const title =
        contract.insurer_name ||
        contract.product_name ||
        contract.policy_number ||
        "Contrat";
      const subtitle = [
        clientName,
        contract.policy_number ? `N° ${contract.policy_number}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      results.push({
        id: `contract-${contract.id}`,
        type: "contract",
        href: `/courtier/clients/${contract.client_id}/contracts/${contract.id}`,
        title,
        subtitle,
      });
    }

    for (const doc of documents) {
      const clientName = namesById.get(doc.client_id) ?? "Client";
      results.push({
        id: `document-${doc.id}`,
        type: "document",
        href: `/courtier/clients/${doc.client_id}`,
        title: doc.title || doc.file_name,
        subtitle: `Document · ${clientName}`,
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[broker-search] failed:", error);
    return NextResponse.json(
      { results: [], error: "search_failed" },
      { status: 500 },
    );
  }
}
