import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { DashboardChartDatum } from "@/components/dashboard/dashboard-activity-chart";
import { dealStatuses, type Deal, type DealStatus } from "@/types/deal";
import type { MockDocument, DocumentStatus, DocumentType } from "@/types/document";
import type { ActivityEvent } from "@/types/activity";
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
  Json,
  OrganizationMemberRow,
  ProfileRow,
  WorkflowRunRow,
} from "@/types/database";

type SupabaseAppClient = NonNullable<
  Awaited<ReturnType<typeof getSupabaseServerClient>>
>;

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

const fallbackIsoDate = "2026-05-07T00:00:00.000Z";

function isRecord(value: Json | null | undefined): value is Record<string, Json> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(
  metadata: Json,
  keys: string[],
  fallback = "",
): string {
  if (!isRecord(metadata)) {
    return fallback;
  }

  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return fallback;
}

function readNumber(metadata: Json, keys: string[], fallback = 0): number {
  if (!isRecord(metadata)) {
    return fallback;
  }

  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function readEmailDraft(metadata: Json): Deal["emailDraft"] {
  if (isRecord(metadata)) {
    const draft = metadata.emailDraft ?? metadata.email_draft;

    if (isRecord(draft)) {
      return {
        subject: readString(draft, ["subject"], "Brouillon email"),
        body: readString(
          draft,
          ["body"],
          "Le brouillon email sera disponible après préparation.",
        ),
      };
    }
  }

  return {
    subject: readString(metadata, ["email_subject"], "Brouillon email"),
    body: readString(
      metadata,
      ["email_body"],
      "Le brouillon email sera disponible après préparation.",
    ),
  };
}

function normalizeDealStatus(status: string | null | undefined): DealStatus {
  if (dealStatuses.includes(status as DealStatus)) {
    return status as DealStatus;
  }

  const statusMap: Record<string, DealStatus> = {
    generating: "proposal_generating",
    review: "validation_pending",
    sent: "email_draft_ready",
    won: "completed",
    lost: "failed",
    queued: "proposal_generating",
    running: "proposal_generating",
    error: "failed",
  };

  return status ? (statusMap[status] ?? "draft") : "draft";
}

function normalizeDocumentType(kind: string): DocumentType {
  const kindMap: Record<string, DocumentType> = {
    summary: "proposal",
    proposal: "proposal",
    presentation: "proposal",
    quote: "quote",
    pdf: "proposal_pdf",
    final_document: "final_document",
    signature: "signature_link",
    signature_link: "signature_link",
    email: "proposal",
  };

  return kindMap[kind] ?? "proposal";
}

function normalizeDocumentStatus(document: DocumentRow): DocumentStatus {
  const metadataStatus = readString(document.metadata, ["status"], "");

  if (["ready", "draft", "generating", "sent"].includes(metadataStatus)) {
    return metadataStatus as DocumentStatus;
  }

  if (document.external_url || document.storage_path) {
    return document.kind === "signature" ? "sent" : "ready";
  }

  return "draft";
}

function getMonthLabel(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "short" })
    .format(new Date(date))
    .replace(".", "");
}

function sortByUpdatedAtDesc<T extends { updated_at: string }>(items: T[]) {
  return [...items].sort(
    (first, second) =>
      new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime(),
  );
}

async function getProfilesById(
  supabase: SupabaseAppClient,
  profileIds: Array<string | null>,
) {
  const ids = [...new Set(profileIds.filter((id): id is string => Boolean(id)))];

  if (ids.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);

  if (error || !data) {
    return new Map<string, ProfileRow>();
  }

  return new Map(data.map((profile) => [profile.id, profile]));
}

function mapDealRow(row: DealRow, owner: ProfileRow | null): Deal {
  const metadata = row.metadata;
  const contactName = row.contact_name ?? readString(metadata, ["clientContactName"]);
  const contactEmail = readString(
    metadata,
    ["clientEmail", "client_email", "email"],
    "Email à renseigner",
  );
  const amountEstimate = readNumber(
    metadata,
    ["amountEstimate", "amount_estimate", "amount"],
    0,
  );
  const updatedAt = row.updated_at ?? row.created_at ?? fallbackIsoDate;

  return {
    id: row.id,
    name: row.title,
    clientCompanyName: row.company_name,
    clientContactName: contactName || "Contact à renseigner",
    clientEmail: contactEmail,
    clientPhone: readString(metadata, ["clientPhone", "client_phone", "phone"]),
    status: normalizeDealStatus(row.status),
    createdAt: row.created_at ?? fallbackIsoDate,
    updatedAt,
    lastAction: readString(
      metadata,
      ["lastAction", "last_action"],
      row.status ? `Statut : ${row.status}` : "Dernière action à renseigner",
    ),
    amountEstimate,
    ownerName: owner?.full_name ?? owner?.email ?? "Équipe FalconDraft",
    priority: "standard",
    expectedCloseDate: readString(
      metadata,
      ["expectedCloseDate", "expected_close_date"],
      updatedAt,
    ),
    source: readString(metadata, ["source"], row.source_notes ?? "Notes"),
    transcript: readString(
      metadata,
      ["transcript", "call_notes"],
      row.source_notes ?? "Aucune note d’appel renseignée.",
    ),
    additionalContext: readString(
      metadata,
      ["additionalContext", "additional_context"],
      "Aucun contexte complémentaire renseigné.",
    ),
    emailInstructions: readString(
      metadata,
      ["emailInstructions", "email_instructions"],
      "Aucune consigne email renseignée.",
    ),
    callSummary: readString(
      metadata,
      ["callSummary", "call_summary"],
      "Le compte-rendu sera disponible après génération.",
    ),
    proposalTitle: readString(
      metadata,
      ["proposalTitle", "proposal_title"],
      `Proposition — ${row.company_name}`,
    ),
    proposalExcerpt: readString(
      metadata,
      ["proposalExcerpt", "proposal_excerpt"],
      "La proposition sera disponible après génération.",
    ),
    finalDocumentName: readString(
      metadata,
      ["finalDocumentName", "final_document_name"],
      "Document final non généré",
    ),
    signatureUrl: readString(
      metadata,
      ["signatureUrl", "signature_url"],
      "Lien de signature non généré",
    ),
    emailDraft: readEmailDraft(metadata),
  };
}

export async function getDealsForOrganization(
  organizationId: string | null,
): Promise<Deal[]> {
  if (!organizationId) {
    return [];
  }

  const supabase = await getSupabaseServerClient();

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

  const owners = await getProfilesById(
    supabase,
    data.map((deal) => deal.owner_profile_id),
  );

  return data.map((deal) =>
    mapDealRow(deal, deal.owner_profile_id ? owners.get(deal.owner_profile_id) ?? null : null),
  );
}

export async function getDealDetail(
  organizationId: string | null,
  dealId: string,
): Promise<DealDetailData> {
  if (!organizationId) {
    return { deal: null, activity: [] };
  }

  const supabase = await getSupabaseServerClient();

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

  const owners = await getProfilesById(supabase, [dealRow.owner_profile_id]);

  const [workflowRuns, auditLogs] = await Promise.all([
    getWorkflowRunsForOrganization(organizationId, dealId),
    getAuditLogsForOrganization(organizationId, dealId),
  ]);

  return {
    deal: mapDealRow(
      dealRow,
      dealRow.owner_profile_id ? owners.get(dealRow.owner_profile_id) ?? null : null,
    ),
    activity: mapActivity(workflowRuns, auditLogs),
  };
}

async function getWorkflowRunsForOrganization(
  organizationId: string,
  dealId?: string,
): Promise<WorkflowRunRow[]> {
  const supabase = await getSupabaseServerClient();

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
  const supabase = await getSupabaseServerClient();

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

function mapActivity(
  workflowRuns: WorkflowRunRow[],
  auditLogs: AuditLogRow[],
): ActivityEvent[] {
  const runEvents = workflowRuns.map<ActivityEvent>((run) => ({
    id: `workflow-${run.id}`,
    dealId: run.deal_id,
    title: workflowRunTitle(run),
    description:
      run.safe_status_message ?? `Flux ${run.type} · statut ${run.status}`,
    createdAt: run.created_at,
    actorName: "FalconDraft",
  }));

  const auditEvents = auditLogs.map<ActivityEvent>((log) => ({
    id: `audit-${log.id}`,
    dealId: log.entity_id ?? "",
    title: log.action,
    description: readString(
      log.metadata,
      ["description", "message"],
      `${log.entity_type} mis à jour`,
    ),
    createdAt: log.created_at,
    actorName: readString(log.metadata, ["actorName", "actor_name"], "Équipe"),
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
  const supabase = await getSupabaseServerClient();

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
      type: normalizeDocumentType(document.kind),
      title: document.title,
      relatedDealId: document.deal_id,
      relatedDealName: deal?.name ?? "Opportunité",
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

  return row.label;
}

export async function getIntegrationsForOrganization(
  organizationId: string | null,
): Promise<IntegrationItem[]> {
  if (!organizationId) {
    return [];
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("label", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((integration) => ({
    id: integration.id,
    name: mapIntegrationName(integration),
    description: readString(
      integration.metadata,
      ["description"],
      "Connexion métier utilisée dans le parcours commercial.",
    ),
    status: integration.enabled ? "connected" : "not_connected",
    actionLabel: integration.enabled ? "Configurer" : "Connecter",
  }));
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

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data: members, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error || !members) {
    return [];
  }

  const profiles = await getProfilesById(
    supabase,
    members.map((member) => member.profile_id),
  );

  return members.map((member: OrganizationMemberRow) => {
    const profile = profiles.get(member.profile_id);
    const status: TeamMemberStatus = profile ? "Actif" : "Invitation envoyée";

    return {
      id: member.id,
      name: profile?.full_name ?? member.invited_email ?? "Utilisateur invité",
      email: profile?.email ?? member.invited_email ?? "Email à renseigner",
      role: roleLabel(member.role),
      status,
      lastActiveAt: profile?.updated_at ?? member.updated_at,
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
    planName: readString(
      subscription.metadata,
      ["planName", "plan_name"],
      "FalconDraft Professionnel",
    ),
    monthlyPrice: readString(
      subscription.metadata,
      ["monthlyPrice", "monthly_price"],
      "Montant à définir",
    ),
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
  if (!subscription) {
    return [];
  }

  const invoiceHistory = isRecord(subscription.metadata)
    ? subscription.metadata.invoice_history
    : null;

  if (!Array.isArray(invoiceHistory)) {
    return subscription.current_period_end
      ? [
          {
            id: `${subscription.id}-next`,
            period: formatMonthYear(subscription.current_period_end),
            amount: readString(
              subscription.metadata,
              ["monthlyPrice", "monthly_price"],
              "Montant à définir",
            ),
            status: "À venir",
          },
        ]
      : [];
  }

  return invoiceHistory
    .filter(isRecord)
    .map((invoice, index) => ({
      id: readString(invoice, ["id"], `${subscription.id}-${index}`),
      period: readString(invoice, ["period"], "Période à définir"),
      amount: readString(invoice, ["amount"], "Montant à définir"),
      status:
        readString(invoice, ["status"], "Payée") === "À venir"
          ? "À venir"
          : "Payée",
    }));
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

  const supabase = await getSupabaseServerClient();

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
      detail: run.safe_status_message ?? "Flux échoué",
      status: run.status,
      updatedAt: run.updated_at,
    })),
  };
}

export { sortByUpdatedAtDesc };
