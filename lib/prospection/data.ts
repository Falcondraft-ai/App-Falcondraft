import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ProspectCompanyRow,
  ProspectingSearchRow,
  ProspectTaskRow,
  ProspectInteractionRow,
} from "@/types/database";

function orgFilter(organizationId: string) {
  return { column: "organization_id", value: organizationId };
}

export async function getProspectCompanies(
  organizationId: string,
  options?: {
    status?: string;
    niche?: string;
    city?: string;
    search?: string;
    includeArchived?: boolean;
    limit?: number;
  },
): Promise<ProspectCompanyRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { column, value } = orgFilter(organizationId);

  let query = supabase
    .from("prospect_companies")
    .select("*")
    .eq(column, value)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (!options?.includeArchived) {
    query = query.neq("status", "archived");
  }

  if (options?.niche) {
    query = query.eq("niche", options.niche);
  }

  if (options?.city) {
    query = query.eq("city", options.city);
  }

  if (options?.search) {
    const term = `%${options.search}%`;
    query = query.or(
      `name.ilike.${term},name_normalized.ilike.${term},website_domain.ilike.${term},phone.ilike.${term}`,
    );
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[prospection] Failed to fetch companies:", error.message);
    return [];
  }

  return data as ProspectCompanyRow[];
}

export async function getProspectCompanyById(
  organizationId: string,
  companyId: string,
): Promise<ProspectCompanyRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("prospect_companies")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    console.error("[prospection] Failed to fetch company:", error.message);
    return null;
  }

  return data as ProspectCompanyRow | null;
}

export async function getProspectingSearches(
  organizationId: string,
): Promise<ProspectingSearchRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { column, value } = orgFilter(organizationId);

  const { data, error } = await supabase
    .from("prospecting_searches")
    .select("*")
    .eq(column, value)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[prospection] Failed to fetch searches:", error.message);
    return [];
  }

  return data as ProspectingSearchRow[];
}

export async function getProspectTasks(
  organizationId: string,
  options?: { status?: string; companyId?: string },
): Promise<(ProspectTaskRow & { company_name?: string | null })[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { column, value } = orgFilter(organizationId);

  let query = supabase
    .from("prospect_tasks")
    .select("*, prospect_companies!prospect_tasks_company_id_fkey(name)")
    .eq(column, value)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.companyId) {
    query = query.eq("company_id", options.companyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[prospection] Failed to fetch tasks:", error.message);
    return [];
  }

  return (data as Array<ProspectTaskRow & {
    prospect_companies?: { name: string } | null;
  }>).map((row) => {
    const { prospect_companies, ...task } = row;
    return {
      ...task,
      company_name: prospect_companies?.name ?? null,
    } as ProspectTaskRow & { company_name?: string | null };
  });
}

export async function getProspectInteractions(
  organizationId: string,
  companyId: string,
): Promise<ProspectInteractionRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("prospect_interactions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[prospection] Failed to fetch interactions:", error.message);
    return [];
  }

  return data as ProspectInteractionRow[];
}

export async function updateProspectCompany(
  companyId: string,
  organizationId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updates: Record<string, any>,
): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("prospect_companies")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
    .eq("id", companyId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[prospection] Failed to update company:", error.message);
    return false;
  }

  return true;
}

export async function updateProspectCompanyStatus(
  companyId: string,
  organizationId: string,
  updates: {
    status?: string;
    last_called_at?: string;
  },
): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("prospect_companies")
    .update(updates)
    .eq("id", companyId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[prospection] Failed to update company status:", error.message);
    return false;
  }

  return true;
}

export async function createProspectInteraction(
  organizationId: string,
  interaction: {
    company_id: string;
    type: string;
    channel: string;
    result: string;
    content?: string;
  },
): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;

  const { error } = await supabase.from("prospect_interactions").insert({
    organization_id: organizationId,
    company_id: interaction.company_id,
    type: interaction.type,
    channel: interaction.channel,
    result: interaction.result,
    content: interaction.content ?? null,
  });

  if (error) {
    console.error("[prospection] Failed to create interaction:", error.message);
    return false;
  }

  return true;
}

export async function updateProspectTask(
  taskId: string,
  organizationId: string,
  updates: { status?: string },
): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("prospect_tasks")
    .update(updates)
    .eq("id", taskId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[prospection] Failed to update task:", error.message);
    return false;
  }

  return true;
}

export async function createProspectingSearch(
  organizationId: string,
  search: {
    name: string;
    niche?: string;
    category_query?: string;
    scope_type?: string;
    location_query?: string;
    max_results?: number;
    notes?: string;
  },
): Promise<ProspectingSearchRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("prospecting_searches")
    .insert({
      organization_id: organizationId,
      name: search.name,
      niche: search.niche ?? null,
      category_query: search.category_query ?? null,
      scope_type: search.scope_type ?? null,
      location_query: search.location_query ?? null,
      max_results: search.max_results ?? null,
      run_mode: "manual",
      status: "active",
      notes: search.notes ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[prospection] Failed to create search:", error.message);
    return null;
  }

  return data as ProspectingSearchRow;
}
