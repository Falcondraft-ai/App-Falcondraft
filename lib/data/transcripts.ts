import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { TranscriptRow, ProfileRow, DealRow, Database } from "@/types/database";
import type { Transcript, TranscriptSource, TranscriptStatus } from "@/types/transcript";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceDataAccess } from "@/lib/auth/workspace-permissions";
import { shouldUseOwnWorkspaceDataOnly } from "@/lib/auth/workspace-permissions";

type SupabaseAppClient = SupabaseClient<Database>;

async function getSupabaseDataClient(): Promise<SupabaseAppClient | null> {
  return (await getSupabaseServerClient()) ?? getSupabaseAdminClient();
}

function normalizeSource(source: string): TranscriptSource {
  if (["manual_paste", "audio_upload", "recall_ai"].includes(source)) {
    return source as TranscriptSource;
  }
  return "manual_paste";
}

function normalizeStatus(status: string): TranscriptStatus {
  if (["ready", "processing", "waiting", "error"].includes(status)) {
    return status as TranscriptStatus;
  }
  return "ready";
}

function mapTranscriptRow(
  row: TranscriptRow,
  profile: ProfileRow | null,
  deal: Pick<DealRow, "name"> | null,
): Transcript {
  return {
    id: row.id,
    title: row.title,
    source: normalizeSource(row.source),
    status: normalizeStatus(row.status),
    language: row.language,
    transcriptText: row.transcript_text,
    dealId: row.deal_id,
    dealName: deal?.name ?? null,
    createdByName: profile?.full_name ?? profile?.email ?? null,
    participants: row.participants as unknown[] | null,
    startedAt: row.started_at,
    durationSeconds: row.duration_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTranscriptsForOrganization(
  organizationId: string | null,
  access?: WorkspaceDataAccess,
): Promise<Transcript[]> {
  if (!organizationId) return [];

  const supabase = await getSupabaseDataClient();
  if (!supabase) return [];

  let query = supabase
    .from("transcripts")
    .select("*")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (access && shouldUseOwnWorkspaceDataOnly(access)) {
    query = query.eq("created_by", access.userId);
  }

  const { data, error } = await query;
  const transcriptRows = (!error && data) ? data : [];

  const userIds = [...new Set(transcriptRows.map((r) => r.created_by))];
  const dealIds = [...new Set(transcriptRows.map((r) => r.deal_id).filter(Boolean))] as string[];

  const [profiles, deals] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("*").in("user_id", userIds).then((r) => r.data ?? [])
      : Promise.resolve([] as ProfileRow[]),
    dealIds.length > 0
      ? supabase.from("deals").select("id, name").in("id", dealIds).then((r) => r.data ?? [])
      : Promise.resolve([] as Pick<DealRow, "id" | "name">[]),
  ]);

  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
  const dealMap = new Map(deals.map((d) => [d.id, d]));

  const transcripts = transcriptRows.map((row) =>
    mapTranscriptRow(
      row,
      profileMap.get(row.created_by) ?? null,
      row.deal_id ? (dealMap.get(row.deal_id) ?? null) : null,
    ),
  );

  // Also include deals that have a transcript field filled but no linked transcript record
  const linkedDealIds = new Set(transcriptRows.map((r) => r.deal_id).filter(Boolean));

  let dealsWithTranscriptQuery = supabase
    .from("deals")
    .select("id, name, client_company_name, transcript, created_by, created_at, updated_at")
    .eq("organization_id", organizationId)
    .not("transcript", "is", null)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (access && shouldUseOwnWorkspaceDataOnly(access)) {
    dealsWithTranscriptQuery = dealsWithTranscriptQuery.eq("created_by", access.userId);
  }

  const { data: dealsWithTranscript } = await dealsWithTranscriptQuery;

  if (dealsWithTranscript) {
    const orphanDeals = dealsWithTranscript.filter(
      (d) => !linkedDealIds.has(d.id) && d.transcript && d.transcript.trim().length > 0,
    );

    const orphanUserIds = [...new Set(orphanDeals.map((d) => d.created_by).filter(Boolean))] as string[];
    let orphanProfiles: ProfileRow[] = [];
    if (orphanUserIds.length > 0) {
      const existing = orphanUserIds.filter((uid) => profileMap.has(uid));
      const missing = orphanUserIds.filter((uid) => !profileMap.has(uid));
      orphanProfiles = existing.map((uid) => profileMap.get(uid)!);
      if (missing.length > 0) {
        const { data: extraProfiles } = await supabase.from("profiles").select("*").in("user_id", missing);
        if (extraProfiles) orphanProfiles = [...orphanProfiles, ...extraProfiles];
      }
    }
    const orphanProfileMap = new Map(orphanProfiles.map((p) => [p.user_id, p]));

    for (const deal of orphanDeals) {
      const profile = deal.created_by ? (profileMap.get(deal.created_by) ?? orphanProfileMap.get(deal.created_by) ?? null) : null;
      transcripts.push({
        id: `deal-${deal.id}`,
        title: `${deal.name} — ${deal.client_company_name}`,
        source: "manual_paste",
        status: "ready",
        language: null,
        transcriptText: deal.transcript,
        dealId: deal.id,
        dealName: deal.name,
        createdByName: profile?.full_name ?? profile?.email ?? null,
        participants: null,
        startedAt: null,
        durationSeconds: null,
        createdAt: deal.created_at,
        updatedAt: deal.updated_at,
      });
    }
  }

  transcripts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return transcripts;
}

export async function getTranscriptById(
  id: string,
  organizationId: string,
): Promise<Transcript | null> {
  const supabase = await getSupabaseDataClient();
  if (!supabase) return null;

  if (id.startsWith("deal-")) {
    const dealId = id.replace("deal-", "");
    const { data: deal } = await supabase
      .from("deals")
      .select("id, name, client_company_name, transcript, created_by, created_at, updated_at")
      .eq("id", dealId)
      .eq("organization_id", organizationId)
      .single();

    if (!deal || !deal.transcript) return null;

    let profileName: string | null = null;
    if (deal.created_by) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", deal.created_by)
        .single();
      profileName = profile?.full_name ?? profile?.email ?? null;
    }

    return {
      id: `deal-${deal.id}`,
      title: `${deal.name} — ${deal.client_company_name}`,
      source: "manual_paste",
      status: "ready",
      language: null,
      transcriptText: deal.transcript,
      dealId: deal.id,
      dealName: deal.name,
      createdByName: profileName,
      participants: null,
      startedAt: null,
      durationSeconds: null,
      createdAt: deal.created_at,
      updatedAt: deal.updated_at,
    };
  }

  const { data, error } = await supabase
    .from("transcripts")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", data.created_by)
    .single();

  let dealName: string | null = null;
  if (data.deal_id) {
    const { data: deal } = await supabase
      .from("deals")
      .select("name")
      .eq("id", data.deal_id)
      .single();
    dealName = deal?.name ?? null;
  }

  return mapTranscriptRow(data, profile ?? null, dealName ? { name: dealName } : null);
}

export async function getDealsForTranscriptLinking(
  organizationId: string,
): Promise<Array<{ id: string; name: string; clientCompanyName: string }>> {
  const supabase = await getSupabaseDataClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("deals")
    .select("id, name, client_company_name")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((d) => ({
    id: d.id,
    name: d.name,
    clientCompanyName: d.client_company_name,
  }));
}

export async function getTranscriptsForLinking(
  organizationId: string,
): Promise<Array<{ id: string; title: string; createdAt: string }>> {
  const supabase = await getSupabaseDataClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("transcripts")
    .select("id, title, created_at")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((t) => ({
    id: t.id,
    title: t.title,
    createdAt: t.created_at,
  }));
}

export async function getLinkedTranscriptForDeal(
  organizationId: string,
  dealId: string,
): Promise<{ id: string; title: string } | null> {
  const supabase = await getSupabaseDataClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("transcripts")
    .select("id, title")
    .eq("organization_id", organizationId)
    .eq("deal_id", dealId)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, title: data.title };
}

export async function getArchivedTranscripts(
  organizationId: string | null,
  access?: WorkspaceDataAccess,
): Promise<Transcript[]> {
  if (!organizationId) return [];

  const supabase = await getSupabaseDataClient();
  if (!supabase) return [];

  let query = supabase
    .from("transcripts")
    .select("*")
    .eq("organization_id", organizationId)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false })
    .limit(200);

  if (access && shouldUseOwnWorkspaceDataOnly(access)) {
    query = query.eq("created_by", access.userId);
  }

  const { data } = await query;
  if (!data) return [];

  const userIds = [...new Set(data.map((r) => r.created_by))];
  const dealIds = [...new Set(data.map((r) => r.deal_id).filter(Boolean))] as string[];

  const [profiles, deals] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("*").in("user_id", userIds).then((r) => r.data ?? [])
      : Promise.resolve([] as ProfileRow[]),
    dealIds.length > 0
      ? supabase.from("deals").select("id, name").in("id", dealIds).then((r) => r.data ?? [])
      : Promise.resolve([] as Pick<DealRow, "id" | "name">[]),
  ]);

  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
  const dealMap = new Map(deals.map((d) => [d.id, d]));

  return data.map((row) =>
    mapTranscriptRow(
      row,
      profileMap.get(row.created_by) ?? null,
      row.deal_id ? (dealMap.get(row.deal_id) ?? null) : null,
    ),
  );
}
