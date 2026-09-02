import "server-only";

import { RENEWAL_HORIZON_DAYS } from "@/lib/broker/contracts";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BrokerActivityRow,
  BrokerAdviceRow,
  BrokerClaimRow,
  BrokerClientRow,
  BrokerCommissionRow,
  BrokerCommissionStatementRow,
  BrokerComplianceRow,
  BrokerContractRow,
  BrokerDocumentRow,
  BrokerEmailDigestRow,
  BrokerEmailItemRow,
  BrokerEmailSuggestionRow,
  BrokerIntroducerRow,
  BrokerQuoteRow,
} from "@/types/database";

export type BrokerClientListOptions = {
  status?: string;
  insuranceType?: string;
  search?: string;
  includeArchived?: boolean;
  limit?: number;
};

export async function getBrokerClients(
  organizationId: string,
  options?: BrokerClientListOptions,
): Promise<BrokerClientRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("broker_clients")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.insuranceType) {
    query = query.eq("insurance_type", options.insuranceType);
  }

  if (options?.search) {
    const term = `%${options.search}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},company_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`,
    );
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[broker] Failed to fetch clients:", error.message);
    return [];
  }

  return (data ?? []) as BrokerClientRow[];
}

export async function getBrokerIntroducers(
  organizationId: string,
  options?: { includeArchived?: boolean },
): Promise<BrokerIntroducerRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("broker_introducers")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[broker] Failed to fetch introducers:", error.message);
    return [];
  }
  return (data ?? []) as BrokerIntroducerRow[];
}

export async function getBrokerClient(
  organizationId: string,
  clientId: string,
): Promise<BrokerClientRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("broker_clients")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    console.error("[broker] Failed to fetch client:", error.message);
    return null;
  }

  return (data as BrokerClientRow | null) ?? null;
}

export async function getBrokerClientActivity(
  organizationId: string,
  clientId: string,
  limit = 30,
): Promise<BrokerActivityRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("broker_activity")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[broker] Failed to fetch activity:", error.message);
    return [];
  }

  return (data ?? []) as BrokerActivityRow[];
}

export async function getBrokerClientDocuments(
  organizationId: string,
  clientId: string,
): Promise<BrokerDocumentRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("broker_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[broker] Failed to fetch documents:", error.message);
    return [];
  }

  return (data ?? []) as BrokerDocumentRow[];
}

export async function getBrokerDocuments(
  organizationId: string,
  options?: { category?: string; limit?: number },
): Promise<BrokerDocumentRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("broker_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (options?.category) {
    query = query.eq("category", options.category);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[broker] Failed to fetch org documents:", error.message);
    return [];
  }

  return (data ?? []) as BrokerDocumentRow[];
}

export async function getBrokerClientQuotes(
  organizationId: string,
  clientId: string,
): Promise<BrokerQuoteRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("broker_quotes")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[broker] Failed to fetch quotes:", error.message);
    return [];
  }

  return (data ?? []) as BrokerQuoteRow[];
}

export async function getBrokerQuote(
  organizationId: string,
  quoteId: string,
): Promise<BrokerQuoteRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("broker_quotes")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", quoteId)
    .maybeSingle();

  if (error) {
    console.error("[broker] Failed to fetch quote:", error.message);
    return null;
  }

  return (data as BrokerQuoteRow | null) ?? null;
}

export async function getBrokerClientAdvice(
  organizationId: string,
  clientId: string,
): Promise<BrokerAdviceRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("broker_advice")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[broker] Failed to fetch advice:", error.message);
    return [];
  }

  return (data ?? []) as BrokerAdviceRow[];
}

export async function getBrokerAdvice(
  organizationId: string,
  adviceId: string,
): Promise<BrokerAdviceRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("broker_advice")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", adviceId)
    .maybeSingle();

  if (error) {
    console.error("[broker] Failed to fetch advice doc:", error.message);
    return null;
  }

  return (data as BrokerAdviceRow | null) ?? null;
}

/**
 * The stored PDF of a devoir de conseil, if it was generated. Matches the
 * deterministic storage path used by the PDF generation route (one GED entry
 * per advice, regenerating overwrites it).
 */
export async function getBrokerAdvicePdfDocument(
  organizationId: string,
  clientId: string,
  adviceId: string,
): Promise<BrokerDocumentRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("broker_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .eq(
      "storage_path",
      `${organizationId}/${clientId}/devoir-de-conseil-${adviceId}.pdf`,
    )
    .maybeSingle();

  if (error) {
    console.error("[broker] Failed to fetch advice PDF doc:", error.message);
    return null;
  }

  return (data as BrokerDocumentRow | null) ?? null;
}

export async function getBrokerRecentActivity(
  organizationId: string,
  limit = 8,
): Promise<BrokerActivityRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("broker_activity")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[broker] Failed to fetch recent activity:", error.message);
    return [];
  }

  return (data ?? []) as BrokerActivityRow[];
}

// ---------------------------------------------------------------------------
// Contracts & renewals
// ---------------------------------------------------------------------------
export type BrokerContractListOptions = {
  status?: string;
  insuranceType?: string;
  insurerName?: string;
  search?: string;
  limit?: number;
};

export async function getBrokerClientContracts(
  organizationId: string,
  clientId: string,
): Promise<BrokerContractRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("broker_contracts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .order("renewal_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[broker] Failed to fetch client contracts:", error.message);
    return [];
  }

  return (data ?? []) as BrokerContractRow[];
}

export async function getBrokerContract(
  organizationId: string,
  contractId: string,
): Promise<BrokerContractRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("broker_contracts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", contractId)
    .maybeSingle();

  if (error) {
    console.error("[broker] Failed to fetch contract:", error.message);
    return null;
  }

  return (data as BrokerContractRow | null) ?? null;
}

export async function getBrokerContracts(
  organizationId: string,
  options?: BrokerContractListOptions,
): Promise<BrokerContractRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("broker_contracts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("renewal_date", { ascending: true, nullsFirst: false });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.insuranceType)
    query = query.eq("insurance_type", options.insuranceType);
  if (options?.insurerName) query = query.eq("insurer_name", options.insurerName);
  if (options?.search) {
    const term = `%${options.search}%`;
    query = query.or(
      `insurer_name.ilike.${term},product_name.ilike.${term},policy_number.ilike.${term}`,
    );
  }
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;

  if (error) {
    console.error("[broker] Failed to fetch contracts:", error.message);
    return [];
  }

  return (data ?? []) as BrokerContractRow[];
}

/**
 * Active/pending contracts whose renewal date falls within `withinDays`
 * (overdue ones are always included), ordered by soonest échéance. Powers the
 * renewals view, the dashboard reminder and the agent.
 */
export async function getBrokerUpcomingRenewals(
  organizationId: string,
  withinDays = RENEWAL_HORIZON_DAYS,
): Promise<BrokerContractRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + withinDays);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("broker_contracts")
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", ["active", "pending"])
    .not("renewal_date", "is", null)
    .lte("renewal_date", horizonIso)
    .order("renewal_date", { ascending: true });

  if (error) {
    console.error("[broker] Failed to fetch upcoming renewals:", error.message);
    return [];
  }

  return (data ?? []) as BrokerContractRow[];
}

// ---------------------------------------------------------------------------
// Compliance (DDA / LCB-FT / RGPD)
// ---------------------------------------------------------------------------
export async function getBrokerClientCompliance(
  organizationId: string,
  clientId: string,
): Promise<BrokerComplianceRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("broker_compliance")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    console.error("[broker] Failed to fetch compliance:", error.message);
    return null;
  }

  return (data as BrokerComplianceRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// Commissions & bordereaux
// ---------------------------------------------------------------------------
export async function getBrokerCommissionStatements(
  organizationId: string,
  options?: { status?: string; limit?: number },
): Promise<BrokerCommissionStatementRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("broker_commission_statements")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) {
    console.error("[broker] Failed to fetch statements:", error.message);
    return [];
  }
  return (data ?? []) as BrokerCommissionStatementRow[];
}

export async function getBrokerCommissionStatement(
  organizationId: string,
  statementId: string,
): Promise<BrokerCommissionStatementRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("broker_commission_statements")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", statementId)
    .maybeSingle();

  if (error) {
    console.error("[broker] Failed to fetch statement:", error.message);
    return null;
  }
  return (data as BrokerCommissionStatementRow | null) ?? null;
}

export async function getBrokerStatementCommissions(
  organizationId: string,
  statementId: string,
): Promise<BrokerCommissionRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("broker_commissions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("statement_id", statementId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[broker] Failed to fetch statement lines:", error.message);
    return [];
  }
  return (data ?? []) as BrokerCommissionRow[];
}

export async function getBrokerCommissions(
  organizationId: string,
  options?: { clientId?: string; contractId?: string; limit?: number },
): Promise<BrokerCommissionRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("broker_commissions")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (options?.clientId) query = query.eq("client_id", options.clientId);
  if (options?.contractId) query = query.eq("contract_id", options.contractId);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) {
    console.error("[broker] Failed to fetch commissions:", error.message);
    return [];
  }
  return (data ?? []) as BrokerCommissionRow[];
}

export async function getBrokerClientCommissions(
  organizationId: string,
  clientId: string,
): Promise<BrokerCommissionRow[]> {
  return getBrokerCommissions(organizationId, { clientId });
}

// ---------------------------------------------------------------------------
// Claims (sinistres)
// ---------------------------------------------------------------------------
export async function getBrokerClientClaims(
  organizationId: string,
  clientId: string,
): Promise<BrokerClaimRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("broker_claims")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[broker] Failed to fetch client claims:", error.message);
    return [];
  }
  return (data ?? []) as BrokerClaimRow[];
}

export async function getBrokerClaim(
  organizationId: string,
  claimId: string,
): Promise<BrokerClaimRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("broker_claims")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", claimId)
    .maybeSingle();

  if (error) {
    console.error("[broker] Failed to fetch claim:", error.message);
    return null;
  }
  return (data as BrokerClaimRow | null) ?? null;
}

export async function getBrokerClaims(
  organizationId: string,
  options?: { status?: string; openOnly?: boolean; limit?: number },
): Promise<BrokerClaimRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("broker_claims")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.openOnly) {
    query = query.in("status", ["declared", "in_progress", "awaiting_docs"]);
  }
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) {
    console.error("[broker] Failed to fetch claims:", error.message);
    return [];
  }
  return (data ?? []) as BrokerClaimRow[];
}

// ---------------------------------------------------------------------------
// Outlook email digest (per-user, RLS-scoped to the caller)
// ---------------------------------------------------------------------------
export async function getLatestEmailDigest(
  organizationId: string,
  userId: string,
): Promise<BrokerEmailDigestRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("broker_email_digests")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[broker] Failed to fetch digest:", error.message);
    return null;
  }
  return (data as BrokerEmailDigestRow | null) ?? null;
}

export async function getEmailDigestDetail(
  organizationId: string,
  digestId: string,
): Promise<{
  items: BrokerEmailItemRow[];
  suggestions: BrokerEmailSuggestionRow[];
}> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { items: [], suggestions: [] };

  const { data: items } = await supabase
    .from("broker_email_items")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("digest_id", digestId)
    .order("received_at", { ascending: false });

  const itemRows = (items ?? []) as BrokerEmailItemRow[];
  if (itemRows.length === 0) return { items: [], suggestions: [] };

  const { data: suggestions } = await supabase
    .from("broker_email_suggestions")
    .select("*")
    .eq("organization_id", organizationId)
    .in(
      "item_id",
      itemRows.map((i) => i.id),
    )
    .order("created_at", { ascending: true });

  return {
    items: itemRows,
    suggestions: (suggestions ?? []) as BrokerEmailSuggestionRow[],
  };
}

export type BrokerDashboardStats = {
  total: number;
  inProgress: number;
  adviceReady: number;
  awaitingSignature: number;
  signed: number;
};

export async function getBrokerDashboardStats(
  organizationId: string,
): Promise<BrokerDashboardStats> {
  const clients = await getBrokerClients(organizationId, { limit: 1000 });

  return clients.reduce<BrokerDashboardStats>(
    (acc, client) => {
      acc.total += 1;
      if (client.status === "in_progress") acc.inProgress += 1;
      if (client.status === "advice_ready") acc.adviceReady += 1;
      if (client.status === "awaiting_signature") acc.awaitingSignature += 1;
      if (client.status === "signed") acc.signed += 1;
      return acc;
    },
    { total: 0, inProgress: 0, adviceReady: 0, awaitingSignature: 0, signed: 0 },
  );
}
