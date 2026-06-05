import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DashboardChartDatum } from "@/components/dashboard/dashboard-activity-chart";
import {
  dealStatuses,
  dealStatusLabels,
  type Deal,
  type DealStatus,
} from "@/types/deal";
import type { ActivityEvent } from "@/types/activity";
import type {
  GeneratedDealDocument,
  MockDocument,
  DocumentStatus,
  DocumentType,
} from "@/types/document";
import type {
  BillingInvoice,
  BillingSubscriptionSummary,
  IntegrationItem,
  PendingInvitation,
  TeamMember,
  TeamMemberStatus,
  TeamRole,
} from "@/types/user";
import { getWorkspaceRoleLabel } from "@/lib/invitations/shared";
import {
  canUseOrganizationDataScope,
  normalizeWorkspaceRole,
  shouldUseOwnWorkspaceDataOnly,
  type WorkspaceDataAccess,
} from "@/lib/auth/workspace-permissions";
import type {
  AuditLogRow,
  BillingDocumentRow,
  BillingSubscriptionRow,
  DealRow,
  DocumentRow,
  IntegrationRow,
  OrganizationMemberRow,
  OrganizationRow,
  ProfileRow,
  WorkflowRunRow,
  Database,
} from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseAppClient = SupabaseClient<Database>;

type DashboardData = {
  deals: Deal[];
  activeDeals: Deal[];
  readyDeals: Deal[];
  readyDocumentCount: number;
  attentionCount: number;
  pipelineValue: number;
  featuredDeal: Deal | null;
  activity: ActivityEvent[];
  chartData: DashboardChartDatum[];
};

type DealDetailData = {
  deal: Deal | null;
  activity: ActivityEvent[];
  documents: GeneratedDealDocument[];
};

type DealQueryOptions = {
  archive?: "exclude" | "only" | "all";
  access?: WorkspaceDataAccess;
};

const fallbackIsoDate = "2026-05-08T00:00:00.000Z";
const selectedProposalPdfExternalId = "selected_proposal_pdf";

async function getSupabaseDataClient(): Promise<SupabaseAppClient | null> {
  return getSupabaseAdminClient() ?? (await getSupabaseServerClient());
}

function normalizeDealStatus(status: string | null | undefined): DealStatus {
  if (dealStatuses.includes(status as DealStatus)) {
    return status as DealStatus;
  }

  const statusMap: Record<string, DealStatus> = {
    generating: "proposal_generating",
    queued: "proposal_generating",
    running: "proposal_generating",
    review: "validation_pending",
    sent: "email_draft_ready",
    won: "completed",
    lost: "failed",
    error: "failed",
  };

  return status ? (statusMap[status] ?? "draft") : "draft";
}

function normalizeDocumentType(type: string): DocumentType {
  const typeMap: Record<string, DocumentType> = {
    summary: "proposal",
    proposal: "proposal",
    proposal_gamma: "proposal_gamma",
    presentation: "proposal",
    quote: "quote",
    quote_pdf: "quote_pdf",
    pdf: "proposal_pdf",
    proposal_pdf: "proposal_pdf",
    proposal_pdf_initial: "proposal_pdf_initial",
    final_document: "final_document",
    final_document_pdf: "final_document_pdf",
    signature: "signature_link",
    signature_link: "signature_link",
    email: "proposal",
  };

  return typeMap[type] ?? "proposal";
}

function normalizeDocumentStatus(document: DocumentRow): DocumentStatus {
  if (["ready", "draft", "generating", "sent"].includes(document.status)) {
    return document.status as DocumentStatus;
  }

  if (document.url) {
    return document.type === "signature" || document.type === "signature_link"
      ? "sent"
      : "ready";
  }

  return "draft";
}

function extractGammaUrl(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/https?:\/\/[^\s)]+/i);

  if (!match) {
    return undefined;
  }

  const url = match[0].replace(/[.,;:!?]+$/, "");

  return url.toLowerCase().includes("gamma") ? url : undefined;
}

function isPdfUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }

  const normalizedUrl = url.toLowerCase();

  return (
    normalizedUrl.includes(".pdf") ||
    normalizedUrl.includes("application/pdf") ||
    normalizedUrl.includes("/proposal-pdfs/")
  );
}

function getProposalEditUrl(
  deal: DealRow,
  documents: DocumentRow[] = [],
): string | undefined {
  const matchingDocument = documents.find((document) => {
    if (!document.url) {
      return false;
    }

    const type = document.type.toLowerCase();
    const title = document.title.toLowerCase();
    const url = document.url.toLowerCase();

    if (isPdfUrl(document.url) || type.includes("pdf")) {
      return false;
    }

    return (
      url.includes("gamma") ||
      type.includes("gamma") ||
      title.includes("gamma") ||
      title.includes("édition") ||
      title.includes("edition")
    );
  });

  return matchingDocument?.url ?? extractGammaUrl(deal.proposal_content);
}

function getGeneratedDocumentLabel(type: string): string {
  const labels: Record<string, string> = {
    proposal_gamma: "Proposition éditable",
    proposal_pdf: "PDF proposition",
    proposal_pdf_initial: "PDF proposition initial",
    proposal_pdf_final_uploaded: "PDF proposition",
    quote_pdf: "Devis PDF",
    final_document_pdf: "Document final prêt à signer",
  };

  return labels[type] ?? "Document";
}

function isProposalPdfDocumentType(type: string): boolean {
  return [
    "proposal_pdf",
    "proposal_pdf_initial",
    "proposal_pdf_final_uploaded",
  ].includes(type);
}

function isGeneratedDealDocument(document: DocumentRow): boolean {
  return [
    "proposal_gamma",
    "quote_pdf",
    "final_document_pdf",
  ].includes(document.type) || isProposalPdfDocumentType(document.type);
}

function hasCompletedProposalValidation(
  workflowRuns: WorkflowRunRow[],
): boolean {
  return workflowRuns.some(
    (run) =>
      run.type === "proposal_validation" &&
      run.status !== "failed" &&
      (run.status === "completed" || Boolean(run.completed_at)),
  );
}

function isPastProposalValidation(status: DealStatus): boolean {
  return [
    "final_document_generating",
    "final_document_ready",
    "signature_ready",
    "email_draft_ready",
    "completed",
  ].includes(status);
}

function mapGeneratedDealDocuments(
  documents: DocumentRow[],
  options: { showProposalPdf?: boolean } = {},
): GeneratedDealDocument[] {
  const latestProposalPdf = documents.find((document) =>
    isProposalPdfDocumentType(document.type),
  );
  const selectedProposalPdf = documents.find(
    (document) =>
      isProposalPdfDocumentType(document.type) &&
      document.external_id === selectedProposalPdfExternalId,
  );
  const visibleProposalPdf = selectedProposalPdf ?? latestProposalPdf;

  return documents
    .filter((document) => {
      if (!isGeneratedDealDocument(document)) {
        return false;
      }

      if (!isProposalPdfDocumentType(document.type)) {
        return true;
      }

      return options.showProposalPdf && document.id === visibleProposalPdf?.id;
    })
    .map((document) => {
      const type = isProposalPdfDocumentType(document.type)
        ? "proposal_pdf"
        : document.type;

      return {
        id: document.id,
        type,
        label: getGeneratedDocumentLabel(type),
        title: document.title,
        status: normalizeDocumentStatus(document),
        createdAt: document.created_at,
        url: document.url ?? undefined,
        hasStoragePath: Boolean(document.storage_path),
        source: "documents" as const,
        downloadUrl: `/api/documents/${document.id}/download?source=documents`,
      };
    });
}

function getMonthLabel(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "short" })
    .format(new Date(date))
    .replace(".", "");
}

export function sortByUpdatedAtDesc<T extends { created_at: string }>(
  items: T[],
) {
  return [...items].sort(
    (first, second) =>
      new Date(second.created_at).getTime() -
      new Date(first.created_at).getTime(),
  );
}

async function getAccessibleDealIdsForOrganization(
  supabase: SupabaseAppClient,
  organizationId: string,
  access?: WorkspaceDataAccess,
) {
  if (!access || !shouldUseOwnWorkspaceDataOnly(access)) {
    return null;
  }

  const { data, error } = await supabase
    .from("deals")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("created_by", access.userId);

  if (error || !data) {
    return [];
  }

  return data.map((deal) => deal.id);
}

async function getProfilesByUserId(
  supabase: SupabaseAppClient,
  userIds: Array<string | null>,
) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];

  if (ids.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("user_id", ids);

  if (error || !data) {
    return new Map<string, ProfileRow>();
  }

  return new Map(data.map((profile) => [profile.user_id, profile]));
}

function lastDealAction(row: DealRow): string {
  const status = normalizeDealStatus(row.status);
  const statusActionLabels: Partial<Record<DealStatus, string>> = {
    validation_pending: "Proposition en validation",
    final_document_generating: "Document final en préparation",
    final_document_ready: "Document final disponible",
    signature_ready: "Signature prête",
    email_draft_ready: "Brouillon email prêt",
    completed: "Dossier terminé",
    failed: "Dernière génération en erreur",
  };

  if (statusActionLabels[status]) {
    return statusActionLabels[status];
  }

  if (row.proposal_content) {
    return "Proposition disponible";
  }

  if (row.call_summary) {
    return "Compte-rendu disponible";
  }

  if (status !== "draft") {
    return dealStatusLabels[status];
  }

  if (row.status === "draft") {
    return "Dossier commercial créé";
  }

  return row.status ? `Statut : ${row.status}` : "Dernière action à renseigner";
}

type ParsedDealTranscript = {
  transcript: string;
  additionalContext: string;
  emailInstructions: string;
  clientPhone?: string;
};

function parseDealTranscript(value: string | null): ParsedDealTranscript {
  const rawTranscript = value?.trim() ?? "";

  if (!rawTranscript) {
    return {
      transcript: "Aucune note d’appel renseignée.",
      additionalContext: "Contexte complémentaire à préciser si nécessaire.",
      emailInstructions: "Consignes email à préciser si nécessaire.",
    };
  }

  const sectionPattern =
    /\n\n(Contexte complémentaire|Instructions email|Téléphone client)\s*:\s*\n/g;
  const matches = [...rawTranscript.matchAll(sectionPattern)];

  if (matches.length === 0) {
    return {
      transcript: rawTranscript,
      additionalContext: "Contexte complémentaire à préciser si nécessaire.",
      emailInstructions: "Consignes email à préciser si nécessaire.",
    };
  }

  const firstSectionIndex = matches[0].index ?? rawTranscript.length;
  const parsedTranscript: ParsedDealTranscript = {
    transcript:
      rawTranscript.slice(0, firstSectionIndex).trim() ||
      "Aucune note d’appel renseignée.",
    additionalContext: "Contexte complémentaire à préciser si nécessaire.",
    emailInstructions: "Consignes email à préciser si nécessaire.",
  };

  matches.forEach((match, index) => {
    const label = match[1];
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? rawTranscript.length;
    const content = rawTranscript.slice(start, end).trim();

    if (!content) {
      return;
    }

    if (label === "Contexte complémentaire") {
      parsedTranscript.additionalContext = content;
      return;
    }

    if (label === "Instructions email") {
      parsedTranscript.emailInstructions = content;
      return;
    }

    parsedTranscript.clientPhone = content;
  });

  return parsedTranscript;
}

function mapDealRow(
  row: DealRow,
  owner: ProfileRow | null,
  documents: DocumentRow[] = [],
): Deal {
  const updatedAt = row.updated_at ?? row.created_at ?? fallbackIsoDate;
  const clientCompanyName = row.client_company_name || "Client à renseigner";
  const proposalContent = row.proposal_content?.trim();
  const hasTranscript = Boolean(row.transcript?.trim());
  const parsedTranscript = parseDealTranscript(row.transcript);
  const additionalContext =
    row.additional_context?.trim() || parsedTranscript.additionalContext;
  const emailInstructions =
    row.email_instructions?.trim() || parsedTranscript.emailInstructions;
  const clientPhone = row.client_phone?.trim() || parsedTranscript.clientPhone;
  const clientCompanyInfo = row.client_company_info?.trim();
  const callSummary = row.call_summary?.trim();
  const quoteContext = row.quote_context?.trim();
  const normalizedStatus = normalizeDealStatus(row.status);
  const effectiveStatus =
    proposalContent &&
    ["draft", "call_summary_ready", "proposal_generating"].includes(
      normalizedStatus,
    )
      ? "proposal_ready"
      : callSummary && normalizedStatus === "draft"
        ? "call_summary_ready"
        : normalizedStatus;

  return {
    id: row.id,
    name: row.name,
    clientCompanyName,
    clientContactName: row.client_contact_name || "Contact à renseigner",
    clientEmail: row.client_email || "Email à renseigner",
    status: effectiveStatus,
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at ?? fallbackIsoDate,
    updatedAt,
    lastAction: lastDealAction(row),
    amountEstimate:
      row.amount_estimate && row.amount_estimate > 0
        ? row.amount_estimate
        : (row.quote_price_ht ?? 0),
    quoteClientType: (row.quote_client_type as "company" | "individual") ?? undefined,
    quotePriceHt: row.quote_price_ht ?? undefined,
    quoteTaxRate: row.quote_tax_rate ?? undefined,
    ownerName: owner?.full_name ?? owner?.email ?? "Équipe FalconDraft",
    priority: "standard",
    expectedCloseDate: row.expected_close_date ?? undefined,
    source: "Notes d’échange",
    transcript: parsedTranscript.transcript,
    additionalContext,
    emailInstructions,
    clientPhone,
    clientCompanyInfo,
    callSummary:
      callSummary || "Le compte-rendu sera disponible après génération.",
    hasTranscript,
    hasCallSummary: Boolean(callSummary),
    hasProposal: Boolean(proposalContent),
    proposalEditUrl: getProposalEditUrl(row, documents),
    quoteContext,
    proposalTitle: `Proposition — ${clientCompanyName}`,
    proposalExcerpt:
      proposalContent || "La proposition sera disponible après génération.",
    finalDocumentName: "Document final non généré",
    signatureUrl: "Lien de signature non généré",
    emailDraft: {
      subject: `Proposition — ${clientCompanyName}`,
      body: "Le brouillon email sera disponible après préparation.",
    },
  };
}

export async function getDealsForOrganization(
  organizationId: string | null,
  options: DealQueryOptions = {},
): Promise<Deal[]> {
  if (!organizationId) {
    return [];
  }

  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return [];
  }

  let query = supabase
    .from("deals")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  const access = options.access;

  if (access && shouldUseOwnWorkspaceDataOnly(access)) {
    query = query.eq("created_by", access.userId);
  }

  if (options.archive === "only") {
    query = query.not("archived_at", "is", null);
  } else if (options.archive !== "all") {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const owners = await getProfilesByUserId(
    supabase,
    data.map((deal) => deal.created_by),
  );

  return data.map((deal) =>
    mapDealRow(
      deal,
      deal.created_by ? (owners.get(deal.created_by) ?? null) : null,
    ),
  );
}

export async function getDealDetail(
  organizationId: string | null,
  dealId: string,
  access?: WorkspaceDataAccess,
): Promise<DealDetailData> {
  if (!organizationId) {
    return { deal: null, activity: [], documents: [] };
  }

  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return { deal: null, activity: [], documents: [] };
  }

  const { data: dealRow, error } = await supabase
    .from("deals")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", dealId)
    .maybeSingle();

  if (error || !dealRow) {
    return { deal: null, activity: [], documents: [] };
  }

  if (
    access &&
    !canUseOrganizationDataScope(
      access.role,
      access.allowMemberCompanyVisibility,
    ) &&
    dealRow.created_by !== access.userId
  ) {
    return { deal: null, activity: [], documents: [] };
  }

  const owners = await getProfilesByUserId(supabase, [dealRow.created_by]);

  const [workflowRuns, auditLogs, documents, billingDocuments] = await Promise.all([
    getWorkflowRunsForOrganization(organizationId, dealId),
    getAuditLogsForOrganization(organizationId, dealId),
    getDocumentRowsForDeal(organizationId, dealId),
    getBillingDocumentRowsForDeal(organizationId, dealId),
  ]);
  const normalizedStatus = normalizeDealStatus(dealRow.status);
  const showProposalPdf =
    hasCompletedProposalValidation(workflowRuns) ||
    isPastProposalValidation(normalizedStatus);

  const mappedDocuments = [
    ...mapGeneratedDealDocuments(documents, { showProposalPdf }),
    ...mapBillingDocumentsForDeal(billingDocuments),
  ];

  return {
    deal: mapDealRow(
      dealRow,
      dealRow.created_by ? (owners.get(dealRow.created_by) ?? null) : null,
      documents,
    ),
    activity: mapActivity(workflowRuns, auditLogs),
    documents: mappedDocuments,
  };
}

async function getWorkflowRunsForOrganization(
  organizationId: string,
  dealId?: string,
  access?: WorkspaceDataAccess,
): Promise<WorkflowRunRow[]> {
  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return [];
  }

  let query = supabase
    .from("workflow_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (dealId) {
    query = query.eq("deal_id", dealId);
  } else {
    const accessibleDealIds = await getAccessibleDealIdsForOrganization(
      supabase,
      organizationId,
      access,
    );

    if (accessibleDealIds && accessibleDealIds.length === 0) {
      return [];
    }

    if (accessibleDealIds) {
      query = query.in("deal_id", accessibleDealIds);
    }
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data;
}

async function getAuditLogsForOrganization(
  organizationId: string,
  dealId?: string,
  access?: WorkspaceDataAccess,
): Promise<AuditLogRow[]> {
  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return [];
  }

  let query = supabase
    .from("audit_logs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (dealId) {
    query = query.eq("entity_id", dealId);
  } else {
    const accessibleDealIds = await getAccessibleDealIdsForOrganization(
      supabase,
      organizationId,
      access,
    );

    if (accessibleDealIds && accessibleDealIds.length === 0) {
      return [];
    }

    if (accessibleDealIds) {
      query = query.in("entity_id", accessibleDealIds);
    }
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data;
}

function workflowRunTitle(run: WorkflowRunRow): string {
  if (run.status === "failed") {
    return "workflow:failed";
  }

  if (run.status === "completed") {
    return "workflow:completed";
  }

  return "workflow:running";
}

function workflowRunDate(run: WorkflowRunRow): string {
  return run.completed_at ?? run.started_at ?? run.created_at;
}

export async function getRecentNotifications(
  organizationId: string,
  limit = 8,
  access?: WorkspaceDataAccess,
): Promise<ActivityEvent[]> {
  const [workflowRuns, auditLogs] = await Promise.all([
    getWorkflowRunsForOrganization(organizationId, undefined, access),
    getAuditLogsForOrganization(organizationId, undefined, access),
  ]);

  return mapActivity(workflowRuns, auditLogs).slice(0, limit);
}

function mapActivity(
  workflowRuns: WorkflowRunRow[],
  auditLogs: AuditLogRow[],
): ActivityEvent[] {
  const runEvents = workflowRuns.map<ActivityEvent>((run) => ({
    id: `workflow-${run.id}`,
    dealId: run.deal_id,
    title: workflowRunTitle(run),
    description: run.error_message ?? `workflow:${run.type}:${run.status}`,
    createdAt: workflowRunDate(run),
    actorName: "system",
  }));

  const auditEvents = auditLogs.map<ActivityEvent>((log) => ({
    id: `audit-${log.id}`,
    dealId: log.entity_id ?? "",
    title: `audit:${log.action}`,
    description: `entity:${log.entity_type}`,
    createdAt: log.created_at,
    actorName: "team",
  }));

  return [...runEvents, ...auditEvents]
    .sort(
      (first, second) =>
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime(),
    )
    .slice(0, 20);
}

function makeChartData(
  workflowRuns: WorkflowRunRow[],
  documents: DocumentRow[],
): DashboardChartDatum[] {
  const monthMap = new Map<string, DashboardChartDatum>();

  for (const run of workflowRuns) {
    const month = getMonthLabel(run.created_at);
    const current = monthMap.get(month) ?? {
      month,
      propositions: 0,
      documents: 0,
    };
    current.propositions += 1;
    monthMap.set(month, current);
  }

  for (const document of documents) {
    const month = getMonthLabel(document.created_at);
    const current = monthMap.get(month) ?? {
      month,
      propositions: 0,
      documents: 0,
    };
    current.documents += 1;
    monthMap.set(month, current);
  }

  return [...monthMap.values()].slice(-6);
}

function getVisibleDocumentRows(documents: DocumentRow[]) {
  const latestDocumentsByTypeAndDeal = new Map<string, DocumentRow>();

  for (const document of documents) {
    if (!["quote_pdf", "final_document_pdf"].includes(document.type)) {
      continue;
    }

    const key = `${document.deal_id}:${document.type}`;

    if (!latestDocumentsByTypeAndDeal.has(key)) {
      latestDocumentsByTypeAndDeal.set(key, document);
    }
  }

  return [...latestDocumentsByTypeAndDeal.values()];
}

export async function getDashboardData(
  organizationId: string | null,
  access?: WorkspaceDataAccess,
): Promise<DashboardData> {
  if (!organizationId) {
    return {
      deals: [],
      activeDeals: [],
      readyDeals: [],
      readyDocumentCount: 0,
      attentionCount: 0,
      pipelineValue: 0,
      featuredDeal: null,
      activity: [],
      chartData: [],
    };
  }

  const [deals, workflowRuns, documents, auditLogs] = await Promise.all([
    getDealsForOrganization(organizationId, { access }),
    getWorkflowRunsForOrganization(organizationId, undefined, access),
    getDocumentRowsForOrganization(organizationId, access),
    getAuditLogsForOrganization(organizationId, undefined, access),
  ]);
  const activeDeals = deals.filter((deal) => deal.status !== "completed");
  const visibleDocuments = getVisibleDocumentRows(documents);
  const readyDeals = deals.filter((deal) =>
    ["proposal_ready", "final_document_ready", "signature_ready"].includes(
      deal.status,
    ),
  );
  const attentionCount = deals.filter((deal) =>
    [
      "proposal_ready",
      "validation_pending",
      "signature_ready",
      "failed",
    ].includes(deal.status),
  ).length;

  return {
    deals,
    activeDeals,
    readyDeals,
    readyDocumentCount: visibleDocuments.filter((document) =>
      ["ready", "sent"].includes(normalizeDocumentStatus(document)),
    ).length,
    attentionCount,
    pipelineValue: activeDeals.reduce(
      (total, deal) => total + deal.amountEstimate,
      0,
    ),
    featuredDeal: deals[0] ?? null,
    activity: mapActivity(workflowRuns, auditLogs).slice(0, 4),
    chartData: makeChartData(workflowRuns, documents),
  };
}

async function getDocumentRowsForOrganization(
  organizationId: string,
  access?: WorkspaceDataAccess,
): Promise<DocumentRow[]> {
  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return [];
  }

  let query = supabase
    .from("documents")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  const accessibleDealIds = await getAccessibleDealIdsForOrganization(
    supabase,
    organizationId,
    access,
  );

  if (accessibleDealIds && accessibleDealIds.length === 0) {
    return [];
  }

  if (accessibleDealIds) {
    query = query.in("deal_id", accessibleDealIds);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data;
}

async function getDocumentRowsForDeal(
  organizationId: string,
  dealId: string,
): Promise<DocumentRow[]> {
  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) {
    return [];
  }

  return data;
}

async function getBillingDocumentRowsForDeal(
  organizationId: string,
  dealId: string,
): Promise<BillingDocumentRow[]> {
  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("billing_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) {
    return [];
  }

  return data;
}

function mapBillingDocumentsForDeal(
  billingDocs: BillingDocumentRow[],
): GeneratedDealDocument[] {
  return billingDocs.map((bd) => {
    const documentType = bd.document_type;
    const title =
      documentType === "quote"
        ? bd.provider_quote_number
          ? `Devis ${bd.provider_quote_number}`
          : "Devis"
        : documentType === "invoice"
          ? "Facture"
          : documentType === "credit_note"
            ? "Avoir"
            : "Document de facturation";

    return {
      id: bd.id,
      type: `billing_${documentType}`,
      label: title,
      title,
      status: bd.provider_status ? mapBillingProviderStatus(bd.provider_status) : "ready",
      createdAt: bd.created_at,
      url: bd.provider_quote_url ?? undefined,
      hasStoragePath: false,
      source: "billing_documents" as const,
      downloadUrl: `/api/documents/${bd.id}/download?source=billing_documents`,
    };
  });
}

function mapBillingProviderStatus(providerStatus: string): DocumentStatus {
  const statusMap: Record<string, DocumentStatus> = {
    accepted: "ready",
    signed: "ready",
    sent: "sent",
    draft: "draft",
    pending: "generating",
    expired: "ready",
    declined: "ready",
  };

  return statusMap[providerStatus] ?? "ready";
}

export async function getDocumentsForOrganization(
  organizationId: string | null,
  access?: WorkspaceDataAccess,
): Promise<MockDocument[]> {
  if (!organizationId) {
    return [];
  }

  const [documents, deals] = await Promise.all([
    getDocumentRowsForOrganization(organizationId, access),
    getDealsForOrganization(organizationId, { archive: "all", access }),
  ]);
  const dealsById = new Map(deals.map((deal) => [deal.id, deal]));

  return getVisibleDocumentRows(documents).map((document) => {
    const deal = dealsById.get(document.deal_id);

    return {
      id: document.id,
      type: normalizeDocumentType(document.type),
      rawType: document.type,
      title: document.title,
      relatedDealId: document.deal_id,
      relatedDealName: deal?.name ?? "Dossier commercial",
      clientCompanyName: deal?.clientCompanyName ?? "Client",
      createdAt: document.created_at,
      status: normalizeDocumentStatus(document),
      ownerName: deal?.ownerName ?? "Équipe FalconDraft",
      url: document.url ?? undefined,
      hasStoragePath: Boolean(document.storage_path),
    };
  });
}

function mapIntegrationName(row: IntegrationRow): string {
  const provider = row.provider.toLowerCase();

  if (provider.includes("gmail") || provider.includes("mail")) {
    return "Messagerie";
  }

  if (provider.includes("sign")) {
    return "Signature";
  }

  if (provider.includes("bill") || provider.includes("stripe")) {
    return "Facturation";
  }

  if (provider.includes("proposal") || provider.includes("generation")) {
    return "Génération de propositions";
  }

  if (provider.includes("n8n") || provider.includes("workflow")) {
    return "Automatisation";
  }

  return row.provider;
}

export async function getIntegrationsForOrganization(
  organizationId: string | null,
): Promise<IntegrationItem[]> {
  if (!organizationId) {
    return [];
  }

  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("provider", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((integration) => {
    const connected = integration.status === "connected";

    return {
      id: integration.id,
      name: mapIntegrationName(integration),
      description: integration.connected_email
        ? `Connecté à ${integration.connected_email}`
        : "Connexion métier utilisée dans le parcours commercial.",
      status: connected ? "connected" : "not_connected",
      actionLabel: connected ? "Configurer" : "Connecter",
    };
  });
}

function roleLabel(role: string): TeamRole {
  return getWorkspaceRoleLabel(role) as TeamRole;
}

function teamMemberRoleKey(role: string) {
  return normalizeWorkspaceRole(role) ?? "member";
}

export async function getTeamMembersForOrganization(
  organizationId: string | null,
): Promise<TeamMember[]> {
  if (!organizationId) {
    return [];
  }

  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return [];
  }

  const { data: members, error } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, status, created_at")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error || !members) {
    return [];
  }

  const profiles = await getProfilesByUserId(
    supabase,
    members.map((member) => member.user_id),
  );

  return members.map((member: OrganizationMemberRow) => {
    const profile = profiles.get(member.user_id);
    const status: TeamMemberStatus = "Actif";

    return {
      id: member.id,
      userId: member.user_id,
      name: profile?.full_name ?? "Utilisateur",
      email: profile?.email ?? "Email à renseigner",
      role: roleLabel(member.role),
      roleKey: teamMemberRoleKey(member.role),
      status,
      lastActiveAt: profile?.created_at ?? member.created_at,
    };
  });
}

export async function getPendingInvitationsForOrganization(
  organizationId: string | null,
): Promise<PendingInvitation[]> {
  if (!organizationId) {
    return [];
  }

  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return [];
  }

  const { data: invitations, error } = await supabase
    .from("organization_invitations")
    .select("id, email, role, status, expires_at, created_at")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error || !invitations) {
    return [];
  }

  return invitations.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: roleLabel(invitation.role),
    roleKey: teamMemberRoleKey(invitation.role),
    status: "Invitation envoyée",
    expiresAt: invitation.expires_at,
    createdAt: invitation.created_at,
  }));
}

const defaultBusinessPlanName = "FalconDraft Business";

function normalizeBillingStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() ?? null;
}

function subscriptionStatusLabel(status: string | null | undefined): string {
  const normalizedStatus = normalizeBillingStatus(status);

  if (!normalizedStatus) {
    return "Inactif";
  }

  if (normalizedStatus === "active") {
    return "Actif";
  }

  if (normalizedStatus === "trial" || normalizedStatus === "trialing") {
    return "Essai";
  }

  if (normalizedStatus === "past_due") {
    return "Paiement à vérifier";
  }

  return "Inactif";
}

function subscriptionDisplayName(status: string | null | undefined) {
  const normalizedStatus = normalizeBillingStatus(status);

  if (normalizedStatus === "active") {
    return defaultBusinessPlanName;
  }

  if (normalizedStatus === "trial" || normalizedStatus === "trialing") {
    return "Essai";
  }

  return "Inactif";
}

function formatMonthYear(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function formatCurrencyAmount(amount: number | null | undefined) {
  if (amount === null || amount === undefined) {
    return "";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function mapSubscriptionSummary(
  subscription: BillingSubscriptionRow | null,
  organization: Pick<
    OrganizationRow,
    "billing_status" | "monthly_subscription_amount"
  > | null,
): BillingSubscriptionSummary {
  const status = organization?.billing_status ?? subscription?.status ?? null;

  if (!subscription) {
    return {
      planName: subscriptionDisplayName(status),
      monthlyPrice: formatCurrencyAmount(
        organization?.monthly_subscription_amount,
      ),
      status: subscriptionStatusLabel(status),
      nextInvoiceLabel: null,
    };
  }

  return {
    planName: subscriptionDisplayName(status),
    monthlyPrice: formatCurrencyAmount(organization?.monthly_subscription_amount),
    status: subscriptionStatusLabel(status),
    nextInvoiceLabel: subscription.current_period_end
      ? new Intl.DateTimeFormat("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(subscription.current_period_end))
      : null,
  };
}

function mapInvoices(
  subscription: BillingSubscriptionRow | null,
  organization: Pick<OrganizationRow, "monthly_subscription_amount"> | null,
): BillingInvoice[] {
  if (!subscription?.current_period_end) {
    return [];
  }

  const amount = formatCurrencyAmount(organization?.monthly_subscription_amount);

  return [
    {
      id: `${subscription.id}-next`,
      period: formatMonthYear(subscription.current_period_end),
      amount,
      status: "À venir",
    },
  ];
}

export async function getBillingForOrganization(
  organizationId: string | null,
): Promise<{
  summary: BillingSubscriptionSummary;
  invoices: BillingInvoice[];
}> {
  if (!organizationId) {
    return { summary: mapSubscriptionSummary(null, null), invoices: [] };
  }

  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return { summary: mapSubscriptionSummary(null, null), invoices: [] };
  }

  const [
    { data: organization, error: organizationError },
    { data: subscription, error: subscriptionError },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("billing_status, monthly_subscription_amount")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("billing_subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  if (organizationError || subscriptionError) {
    return { summary: mapSubscriptionSummary(null, null), invoices: [] };
  }

  return {
    summary: mapSubscriptionSummary(subscription, organization),
    invoices: mapInvoices(subscription, organization),
  };
}

export async function getAdminData(organizationId: string | null) {
  if (!organizationId) {
    return {
      metrics: [
        { label: "Organisations", value: "0", detail: "Aucun espace chargé" },
        { label: "Utilisateurs", value: "0", detail: "Aucun membre chargé" },
        { label: "Opportunités", value: "0", detail: "Aucune donnée chargée" },
        { label: "Flux échoués", value: "0", detail: "Aucune donnée chargée" },
      ],
      rows: [],
      failedRuns: [],
    };
  }

  const [deals, members, workflowRuns] = await Promise.all([
    getDealsForOrganization(organizationId),
    getTeamMembersForOrganization(organizationId),
    getWorkflowRunsForOrganization(organizationId),
  ]);
  const failedRuns = workflowRuns.filter((run) => run.status === "failed");

  return {
    metrics: [
      { label: "Organisations", value: "1", detail: "Espace courant" },
      {
        label: "Utilisateurs",
        value: String(members.length),
        detail: "Collaborateurs de l’espace",
      },
      {
        label: "Opportunités",
        value: String(deals.length),
        detail: "Pipeline courant",
      },
      {
        label: "Flux échoués",
        value: String(failedRuns.length),
        detail: "À vérifier",
      },
    ],
    rows: deals.slice(0, 8).map((deal) => ({
      id: deal.id,
      name: deal.name,
      detail: deal.clientCompanyName,
      status: deal.status,
      updatedAt: deal.updatedAt,
    })),
    failedRuns: failedRuns.map((run) => ({
      id: run.id,
      name: run.type,
      detail: run.error_message ?? "Flux échoué",
      status: run.status,
      updatedAt: workflowRunDate(run),
    })),
  };
}
