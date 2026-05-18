import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ProspectCompanyRow,
  ProspectingSearchRow,
  ProspectTaskRow,
  ProspectInteractionRow,
  ProspectDocumentRow,
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
