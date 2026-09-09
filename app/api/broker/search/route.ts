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

export type BrokerSearchType =
  | "client"
  | "contract"
  | "document"
  | "quote"
  | "claim";

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

    // Devis compagnie — cherchés par compagnie, produit ou référence. Ils
    // manquaient à l'appel : un devis se retrouvait par le nom du client, mais
    // jamais par celui de la compagnie qui l'a émis.
    const quotesPromise = admin
      ? admin
          .from("broker_quotes")
          .select("id, client_id, insurer_name, product_name")
          .eq("organization_id", organizationId)
          .or(`insurer_name.ilike.${like},product_name.ilike.${like}`)
          .limit(5)
      : Promise.resolve({ data: [] });

    // Sinistres — par nature, référence ou description.
    const claimsPromise = admin
      ? admin
          .from("broker_claims")
          .select(
            "id, client_id, claim_type, reference, description, insurer_name, status",
          )
          .eq("organization_id", organizationId)
          .or(
            `claim_type.ilike.${like},reference.ilike.${like},description.ilike.${like},insurer_name.ilike.${like}`,
          )
          .limit(5)
      : Promise.resolve({ data: [] });

    const [clients, contractsRes, documentsRes, quotesRes, claimsRes] =
      await Promise.all([
        clientsPromise,
        contractsPromise,
        documentsPromise,
        quotesPromise,
        claimsPromise,
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
    const quotes = (quotesRes.data ?? []) as {
      id: string;
      client_id: string;
      insurer_name: string | null;
      product_name: string | null;
    }[];
    const claims = (claimsRes.data ?? []) as {
      id: string;
      client_id: string;
      claim_type: string | null;
      reference: string | null;
      description: string | null;
      insurer_name: string | null;
      status: string;
    }[];

    // Resolve client names for contract/document subtitles in one query.
    const extraClientIds = [
      ...new Set([
        ...contracts.map((c) => c.client_id),
        ...documents.map((d) => d.client_id),
        ...quotes.map((q) => q.client_id),
        ...claims.map((c) => c.client_id),
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

    for (const quote of quotes) {
      const clientName = namesById.get(quote.client_id) ?? "Client";
      const title = quote.insurer_name || quote.product_name || "Devis";
      results.push({
        id: `quote-${quote.id}`,
        type: "quote",
        // Le devis a sa propre page : on y va directement, le dossier reste à
        // un clic par le fil d'Ariane.
        href: `/courtier/clients/${quote.client_id}/quotes/${quote.id}`,
        title,
        subtitle: [clientName, quote.product_name]
          .filter(Boolean)
          .join(" · "),
      });
    }

    for (const claim of claims) {
      const clientName = namesById.get(claim.client_id) ?? "Client";
      const title = claim.claim_type || claim.reference || "Sinistre";
      results.push({
        id: `claim-${claim.id}`,
        type: "claim",
        href: `/courtier/clients/${claim.client_id}/claims/${claim.id}`,
        title,
        subtitle: [clientName, claim.reference ? `N° ${claim.reference}` : null]
          .filter(Boolean)
          .join(" · "),
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
