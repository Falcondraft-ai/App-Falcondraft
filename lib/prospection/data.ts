import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ProspectCompanyRow,
  ProspectingSearchRow,
  ProspectTaskRow,
  ProspectInteractionRow,
  ProspectDocumentRow,
  ProspectSearchResultRow,
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
    .order("fit_score", { ascending: false, nullsFirst: false });

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
    include_keywords?: string | null;
    exclude_keywords?: string | null;
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
      category_query: search.category_query ?? "Tout",
      scope_type: search.scope_type ?? null,
      location_query: search.location_query ?? null,
      max_results: search.max_results ?? null,
      run_mode: "manual",
      status: "active",
      notes: search.notes ?? null,
      include_keywords: search.include_keywords ?? null,
      exclude_keywords: search.exclude_keywords ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[prospection] Failed to create search:", error.message);
    return null;
  }

  return data as ProspectingSearchRow;
}

// --- Document functions ---

export async function getProspectDocuments(
  organizationId: string,
  companyId: string,
  userId: string,
  isManager: boolean,
): Promise<ProspectDocumentRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("prospect_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (!isManager) {
    query = query.eq("uploaded_by", userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[prospection] Failed to fetch documents:", error.message);
    return [];
  }

  return data as ProspectDocumentRow[];
}

export async function getAllProspectDocuments(
  organizationId: string,
): Promise<ProspectDocumentRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("prospect_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[prospection] Failed to fetch all documents:", error.message);
    return [];
  }

  return data as ProspectDocumentRow[];
}

export async function getProspectDocumentById(
  documentId: string,
  organizationId: string,
): Promise<ProspectDocumentRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("prospect_documents")
    .select("*")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;

  return data as ProspectDocumentRow;
}

export async function createProspectDocument(
  organizationId: string,
  doc: {
    company_id: string;
    uploaded_by: string;
    file_name: string;
    file_path: string;
    mime_type: string;
    size_bytes: number;
    document_type?: string;
  },
): Promise<ProspectDocumentRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("prospect_documents")
    .insert({
      organization_id: organizationId,
      company_id: doc.company_id,
      uploaded_by: doc.uploaded_by,
      document_type: doc.document_type ?? "client_file",
      file_name: doc.file_name,
      file_path: doc.file_path,
      mime_type: doc.mime_type,
      size_bytes: doc.size_bytes,
      status: "active",
    })
    .select("*")
    .single();

  if (error) {
    console.error("[prospection] Failed to create document:", error.message);
    return null;
  }

  return data as ProspectDocumentRow;
}

export async function archiveProspectDocument(
  documentId: string,
  organizationId: string,
  userId: string,
  isManager: boolean,
): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;

  const doc = await getProspectDocumentById(documentId, organizationId);
  if (!doc) return false;

  if (!isManager && doc.uploaded_by !== userId) return false;

  const { error } = await supabase
    .from("prospect_documents")
    .update({ status: "archived" })
    .eq("id", documentId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[prospection] Failed to archive document:", error.message);
    return false;
  }

  return true;
}

export async function permanentlyDeleteProspectDocument(
  documentId: string,
  organizationId: string,
): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;

  const doc = await getProspectDocumentById(documentId, organizationId);
  if (!doc) return false;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return false;

  const { error: storageError } = await adminClient.storage
    .from("prospection-documents")
    .remove([doc.file_path]);

  if (storageError) {
    console.error("[prospection] Failed to remove file from storage:", storageError.message);
  }

  const { error } = await supabase
    .from("prospect_documents")
    .update({ deleted_at: new Date().toISOString(), status: "deleted" })
    .eq("id", documentId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[prospection] Failed to mark document deleted:", error.message);
    return false;
  }

  return true;
}

export async function getProspectDocumentSignedUrl(
  filePath: string,
): Promise<string | null> {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return null;

  const { data, error } = await adminClient.storage
    .from("prospection-documents")
    .createSignedUrl(filePath, 120);

  if (error || !data?.signedUrl) {
    console.error("[prospection] Failed to create signed URL:", error?.message);
    return null;
  }

  return data.signedUrl;
}

// --- Search Results functions ---

export async function getProspectingSearchById(
  searchId: string,
  organizationId: string,
): Promise<ProspectingSearchRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("prospecting_searches")
    .select("*")
    .eq("id", searchId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProspectingSearchRow;
}

export async function getProspectSearchResults(
  searchId: string,
  organizationId: string,
): Promise<ProspectSearchResultRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("prospect_search_results")
    .select("*")
    .eq("search_id", searchId)
    .eq("organization_id", organizationId)
    .order("fit_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[prospection] Failed to fetch search results:", error.message);
    return [];
  }

  return data as ProspectSearchResultRow[];
}

export async function updateSearchResultReviewStatus(
  resultId: string,
  organizationId: string,
  reviewStatus: "pending_review" | "selected" | "ignored",
): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("prospect_search_results")
    .update({ review_status: reviewStatus })
    .eq("id", resultId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[prospection] Failed to update review status:", error.message);
    return false;
  }

  return true;
}

export async function updateSearchLastRunAt(
  searchId: string,
  organizationId: string,
): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("prospecting_searches")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", searchId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[prospection] Failed to update last_run_at:", error.message);
    return false;
  }

  return true;
}

export async function importSingleSearchResult(
  resultId: string,
  organizationId: string,
): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;

  const { data: result, error: fetchError } = await supabase
    .from("prospect_search_results")
    .select("*")
    .eq("id", resultId)
    .eq("organization_id", organizationId)
    .single();

  if (fetchError || !result) return false;

  const r = result as ProspectSearchResultRow;

  if (r.review_status === "ignored") return false;

  const { error: importError } = await supabase.from("prospect_companies").upsert(
    {
      organization_id: organizationId,
      source: r.source ?? null,
      google_place_id: r.google_place_id ?? null,
      name: r.name,
      name_normalized: r.name_normalized ?? null,
      website: r.website ?? null,
      website_domain: r.website_domain ?? null,
      phone: r.phone ?? null,
      formatted_address: r.formatted_address ?? null,
      city: r.city ?? null,
      region: r.region ?? null,
      country: r.country ?? null,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      google_primary_type: r.google_primary_type ?? null,
      google_primary_type_display_name: r.google_primary_type_display_name ?? null,
      google_types: r.google_types ?? null,
      rating: r.rating ?? null,
      user_rating_count: r.user_rating_count ?? null,
      niche: r.niche ?? null,
      category_query: r.category_query ?? null,
      source_search_id: r.search_id ?? null,
      fit_score: r.fit_score ?? null,
      priority: r.priority ?? null,
      reason_for_fit: r.reason_for_fit ?? null,
      recommended_angle: r.recommended_angle ?? null,
      status: "to_call",
      raw_google_data: r.raw_google_data ?? null,
    },
    {
      onConflict: "organization_id, google_place_id",
      ignoreDuplicates: false,
    },
  );

  if (importError) {
    console.error("[prospection] Failed to import company:", importError.message);
    return false;
  }

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("prospect_tasks").insert({
    organization_id: organizationId,
    company_id: null,
    title: `Appeler ${r.name}`,
    type: "call",
    status: "todo",
    due_at: tomorrow,
  });

  await supabase.from("prospect_interactions").insert({
    organization_id: organizationId,
    company_id: null,
    type: "note",
    channel: "system",
    result: "imported_from_search_preview",
    content: "Lead importé depuis les résultats de recherche FalconDraft.",
  });

  await supabase
    .from("prospect_search_results")
    .delete()
    .eq("id", resultId);

  return true;
}

export async function importSelectedSearchResults(
  searchId: string,
  organizationId: string,
): Promise<{ imported: number; failed: number }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { imported: 0, failed: 0 };

  const { data, error } = await supabase
    .from("prospect_search_results")
    .select("id")
    .eq("search_id", searchId)
    .eq("organization_id", organizationId)
    .eq("review_status", "selected");

  if (error || !data) return { imported: 0, failed: 0 };

  let imported = 0;
  let failed = 0;

  for (const row of data) {
    const ok = await importSingleSearchResult(row.id, organizationId);
    if (ok) imported++;
    else failed++;
  }

  return { imported, failed };
}

export async function importAllValidSearchResults(
  searchId: string,
  organizationId: string,
): Promise<{ imported: number; failed: number }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { imported: 0, failed: 0 };

  const { data, error } = await supabase
    .from("prospect_search_results")
    .select("id")
    .eq("search_id", searchId)
    .eq("organization_id", organizationId)
    .not("review_status", "in", '("ignored")');

  if (error || !data) return { imported: 0, failed: 0 };

  let imported = 0;
  let failed = 0;

  for (const row of data) {
    const ok = await importSingleSearchResult(row.id, organizationId);
    if (ok) imported++;
    else failed++;
  }

  return { imported, failed };
}
