import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DashboardChartDatum } from "@/components/dashboard/dashboard-activity-chart";
import { dealStatuses, type Deal, type DealStatus } from "@/types/deal";
import type { ActivityEvent } from "@/types/activity";
import type { MockDocument, DocumentStatus, DocumentType } from "@/types/document";
import type {
  BillingInvoice,
  BillingSubscriptionSummary,
  IntegrationItem,
  TeamMember,
  TeamMemberStatus,
  TeamRole,
} from "@/types/user";
import type {
  AuditLogRow,
  BillingSubscriptionRow,
  DealRow,
  DocumentRow,
  IntegrationRow,
  OrganizationMemberRow,
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
  pipelineValue: number;
  averageCycleLabel: string;
  featuredDeal: Deal | null;
  activity: ActivityEvent[];
  chartData: DashboardChartDatum[];
};

type DealDetailData = {
  deal: Deal | null;
  activity: ActivityEvent[];
};

const fallbackIsoDate = "2026-05-08T00:00:00.000Z";

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
    presentation: "proposal",
    quote: "quote",
    pdf: "proposal_pdf",
    proposal_pdf: "proposal_pdf",
    final_document: "final_document",
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

    return (
      url.includes("gamma") ||
      type.includes("gamma") ||
      title.includes("gamma") ||
      title.includes("édition") ||
      title.includes("edition") ||
      (type.includes("proposal") && !type.includes("pdf")) ||
      (type.includes("proposition") && !type.includes("pdf"))
    );
  });

  return matchingDocument?.url ?? extractGammaUrl(deal.proposal_content);
}

function getMonthLabel(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "short" })
    .format(new Date(date))
    .replace(".", "");
}

export function sortByUpdatedAtDesc<T extends { created_at: string }>(items: T[]) {
  return [...items].sort(
    (first, second) =>
      new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
  );
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
  if (row.call_summary) {
    return "Compte-rendu disponible";
  }

  if (row.proposal_content) {
    return "Proposition disponible";
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
    createdAt: row.created_at ?? fallbackIsoDate,
    updatedAt,
    lastAction: lastDealAction(row),
    amountEstimate: row.amount_estimate ?? 0,
    ownerName: owner?.full_name ?? owner?.email ?? "Équipe FalconDraft",
    priority: "standard",
    expectedCloseDate: updatedAt,
    source: "Notes d’échange",
    transcript: parsedTranscript.transcript,
    additionalContext,
    emailInstructions,
    clientPhone,
    clientCompanyInfo,
    callSummary: callSummary || "Le compte-rendu sera disponible après génération.",
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
): Promise<Deal[]> {
  if (!organizationId) {
    return [];
  }

  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  const owners = await getProfilesByUserId(
    supabase,
    data.map((deal) => deal.created_by),
  );

  return data.map((deal) =>
    mapDealRow(deal, deal.created_by ? owners.get(deal.created_by) ?? null : null),
  );
}

export async function getDealDetail(
  organizationId: string | null,
  dealId: string,
): Promise<DealDetailData> {
  if (!organizationId) {
    return { deal: null, activity: [] };
  }

  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return { deal: null, activity: [] };
  }

  const { data: dealRow, error } = await supabase
    .from("deals")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", dealId)
    .maybeSingle();

  if (error || !dealRow) {
    return { deal: null, activity: [] };
  }

  const owners = await getProfilesByUserId(supabase, [dealRow.created_by]);

  const [workflowRuns, auditLogs, documents] = await Promise.all([
    getWorkflowRunsForOrganization(organizationId, dealId),
    getAuditLogsForOrganization(organizationId, dealId),
    getDocumentRowsForDeal(organizationId, dealId),
  ]);

  return {
    deal: mapDealRow(
      dealRow,
      dealRow.created_by ? owners.get(dealRow.created_by) ?? null : null,
      documents,
    ),
    activity: mapActivity(workflowRuns, auditLogs),
  };
}

async function getWorkflowRunsForOrganization(
  organizationId: string,
  dealId?: string,
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
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data;
}

function workflowRunTitle(run: WorkflowRunRow): string {
  if (run.status === "failed") {
    return "Génération échouée";
  }

  if (run.status === "completed") {
    return "Génération terminée";
  }

  return "Génération en cours";
}

function workflowRunDate(run: WorkflowRunRow): string {
  return run.completed_at ?? run.started_at ?? run.created_at;
}

function mapActivity(
  workflowRuns: WorkflowRunRow[],
  auditLogs: AuditLogRow[],
): ActivityEvent[] {
  const runEvents = workflowRuns.map<ActivityEvent>((run) => ({
    id: `workflow-${run.id}`,
    dealId: run.deal_id,
    title: workflowRunTitle(run),
    description: run.error_message ?? `Flux ${run.type} · statut ${run.status}`,
    createdAt: workflowRunDate(run),
    actorName: "FalconDraft",
  }));

  const auditEvents = auditLogs.map<ActivityEvent>((log) => ({
    id: `audit-${log.id}`,
    dealId: log.entity_id ?? "",
    title: log.action,
    description: `${log.entity_type} mis à jour`,
    createdAt: log.created_at,
    actorName: "Équipe",
  }));

  return [...runEvents, ...auditEvents]
    .sort(
      (first, second) =>
        new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
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
    const current =
      monthMap.get(month) ?? { month, propositions: 0, documents: 0 };
    current.propositions += 1;
    monthMap.set(month, current);
  }

  for (const document of documents) {
    const month = getMonthLabel(document.created_at);
    const current =
      monthMap.get(month) ?? { month, propositions: 0, documents: 0 };
    current.documents += 1;
    monthMap.set(month, current);
  }

  return [...monthMap.values()].slice(-6);
}

export async function getDashboardData(
  organizationId: string | null,
): Promise<DashboardData> {
  if (!organizationId) {
    return {
      deals: [],
      activeDeals: [],
      readyDeals: [],
      readyDocumentCount: 0,
      pipelineValue: 0,
      averageCycleLabel: "—",
      featuredDeal: null,
      activity: [],
      chartData: [],
    };
  }

  const [deals, workflowRuns, documents, auditLogs] = await Promise.all([
    getDealsForOrganization(organizationId),
    getWorkflowRunsForOrganization(organizationId),
    getDocumentRowsForOrganization(organizationId),
    getAuditLogsForOrganization(organizationId),
  ]);
  const activeDeals = deals.filter((deal) => deal.status !== "completed");
  const readyDeals = deals.filter((deal) =>
    ["proposal_ready", "final_document_ready", "signature_ready"].includes(
      deal.status,
    ),
  );

  return {
    deals,
    activeDeals,
    readyDeals,
    readyDocumentCount: documents.filter((document) =>
      ["ready", "sent"].includes(normalizeDocumentStatus(document)),
    ).length,
    pipelineValue: activeDeals.reduce(
      (total, deal) => total + deal.amountEstimate,
      0,
    ),
    averageCycleLabel: "—",
    featuredDeal: deals[0] ?? null,
    activity: mapActivity(workflowRuns, auditLogs).slice(0, 4),
    chartData: makeChartData(workflowRuns, documents),
  };
}

async function getDocumentRowsForOrganization(
  organizationId: string,
): Promise<DocumentRow[]> {
  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

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

export async function getDocumentsForOrganization(
  organizationId: string | null,
): Promise<MockDocument[]> {
  if (!organizationId) {
    return [];
  }

  const [documents, deals] = await Promise.all([
    getDocumentRowsForOrganization(organizationId),
    getDealsForOrganization(organizationId),
  ]);
  const dealsById = new Map(deals.map((deal) => [deal.id, deal]));

  return documents.map((document) => {
    const deal = dealsById.get(document.deal_id);

    return {
      id: document.id,
      type: normalizeDocumentType(document.type),
      title: document.title,
      relatedDealId: document.deal_id,
      relatedDealName: deal?.name ?? "Dossier commercial",
      clientCompanyName: deal?.clientCompanyName ?? "Client",
      createdAt: document.created_at,
      status: normalizeDocumentStatus(document),
      ownerName: deal?.ownerName ?? "Équipe FalconDraft",
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
  if (role === "owner") {
    return "Propriétaire";
  }

  if (role === "admin") {
    return "Administrateur";
  }

  return "Membre";
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
      name: profile?.full_name ?? "Utilisateur",
      email: profile?.email ?? "Email à renseigner",
      role: roleLabel(member.role),
      status,
      lastActiveAt: profile?.created_at ?? member.created_at,
    };
  });
}

function subscriptionStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "À configurer";
  }

  if (status === "active" || status === "trialing") {
    return "Actif";
  }

  if (status === "past_due") {
    return "Paiement à vérifier";
  }

  return status;
}

function formatMonthYear(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function mapSubscriptionSummary(
  subscription: BillingSubscriptionRow | null,
): BillingSubscriptionSummary {
  if (!subscription) {
    return {
      planName: "FalconDraft Professionnel",
      monthlyPrice: "À définir",
      status: "À configurer",
      nextInvoiceLabel: "Échéance à définir",
    };
  }

  return {
    planName: subscription.plan ?? "FalconDraft Professionnel",
    monthlyPrice: "Montant à définir",
    status: subscriptionStatusLabel(subscription.status),
    nextInvoiceLabel: subscription.current_period_end
      ? new Intl.DateTimeFormat("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(subscription.current_period_end))
      : "Échéance à définir",
  };
}

function mapInvoices(subscription: BillingSubscriptionRow | null): BillingInvoice[] {
  if (!subscription?.current_period_end) {
    return [];
  }

  return [
    {
      id: `${subscription.id}-next`,
      period: formatMonthYear(subscription.current_period_end),
      amount: "Montant à définir",
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
    return { summary: mapSubscriptionSummary(null), invoices: [] };
  }

  const supabase = await getSupabaseDataClient();

  if (!supabase) {
    return { summary: mapSubscriptionSummary(null), invoices: [] };
  }

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    return { summary: mapSubscriptionSummary(null), invoices: [] };
  }

  return {
    summary: mapSubscriptionSummary(data),
    invoices: mapInvoices(data),
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
        detail: "Membres de l’espace",
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
