import {
  index,
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  billingStatus: text("billing_status").notNull(),
  setupAmount: numeric("setup_amount", { mode: "number" }),
  monthlySubscriptionAmount: numeric("monthly_subscription_amount", {
    mode: "number",
  }),
    allowMemberCompanyVisibility: boolean("allow_member_company_visibility")
      .default(true)
      .notNull(),
    defaultQuoteClientType: text("default_quote_client_type")
      .default("company")
      .notNull(),
    defaultQuoteTaxRate: numeric("default_quote_tax_rate", {
      mode: "number",
    })
      .default(20)
      .notNull(),
    defaultBillingProvider: text("default_billing_provider")
      .default("qonto")
      .notNull(),
    meetingBotName: text("meeting_bot_name")
      .default("FalconDraft")
      .notNull(),
    workspaceType: text("workspace_type")
      .default("sales_automation")
      .notNull(),
    brokerOffering: text("broker_offering").default("saas").notNull(),
    plan: text("plan"),
    planSeats: integer("plan_seats"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    storageLimitBytes: bigint("storage_limit_bytes", { mode: "number" })
      .default(268435456000)
      .notNull(),
    storageUsedBytes: bigint("storage_used_bytes", { mode: "number" })
      .default(0)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull(),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("organization_members_organization_id_idx").on(
      table.organizationId,
    ),
    memberUniqueIdx: uniqueIndex("organization_members_user_unique_idx").on(
      table.organizationId,
      table.userId,
    ),
  }),
);

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    clientCompanyName: text("client_company_name").notNull(),
    clientContactName: text("client_contact_name"),
    clientEmail: text("client_email"),
    status: text("status").default("draft").notNull(),
    transcript: text("transcript"),
    additionalContext: text("additional_context"),
    emailInstructions: text("email_instructions"),
    clientPhone: text("client_phone"),
    clientCompanyInfo: text("client_company_info"),
    callSummary: text("call_summary"),
    proposalContent: text("proposal_content"),
    quoteContext: text("quote_context"),
    amountEstimate: numeric("amount_estimate", { mode: "number" }),
    quoteClientType: text("quote_client_type"),
    quotePriceHt: numeric("quote_price_ht", { mode: "number" }),
    quoteTaxRate: numeric("quote_tax_rate", { mode: "number" }),
    expectedCloseDate: date("expected_close_date"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("deals_organization_id_idx").on(table.organizationId),
    statusIdx: index("deals_status_idx").on(table.status),
    archivedAtIdx: index("deals_archived_at_idx").on(table.archivedAt),
  }),
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    status: text("status").default("pending").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("workflow_runs_organization_id_idx").on(
      table.organizationId,
    ),
    dealIdx: index("workflow_runs_deal_id_idx").on(table.dealId),
  }),
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    storagePath: text("storage_path"),
    externalId: text("external_id"),
    status: text("status").default("draft").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("documents_organization_id_idx").on(
      table.organizationId,
    ),
    dealIdx: index("documents_deal_id_idx").on(table.dealId),
    externalIdIdx: index("documents_external_id_idx").on(table.externalId),
  }),
);

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    status: text("status").notNull(),
    connectedEmail: text("connected_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationProviderIdx: uniqueIndex(
      "integrations_organization_provider_idx",
    ).on(table.organizationId, table.provider),
  }),
);

export const emailConnections = pgTable(
  "email_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    provider: text("provider").notNull(),
    email: text("email").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    status: text("status").default("connected").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("email_connections_organization_id_idx").on(
      table.organizationId,
    ),
    userProviderIdx: uniqueIndex("email_connections_user_provider_idx").on(
      table.organizationId,
      table.userId,
      table.provider,
    ),
  }),
);

export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    status: text("status").notNull(),
    plan: text("plan"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: uniqueIndex(
      "billing_subscriptions_organization_id_idx",
    ).on(table.organizationId),
  }),
);

export const workflowConfigs = pgTable(
  "workflow_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    workflowType: text("workflow_type").notNull(),
    n8nWebhookUrl: text("n8n_webhook_url").notNull(),
    n8nWorkflowId: text("n8n_workflow_id"),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("workflow_configs_organization_id_idx").on(
      table.organizationId,
    ),
    organizationWorkflowUniqueIdx: uniqueIndex(
      "workflow_configs_organization_workflow_type_idx",
    ).on(table.organizationId, table.workflowType),
  }),
);

export const transcripts = pgTable(
  "transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull(),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    source: text("source").notNull().default("manual_paste"),
    status: text("status").notNull().default("ready"),
    language: text("language"),
    transcriptText: text("transcript_text"),
    audioStoragePath: text("audio_storage_path"),
    recallBotId: text("recall_bot_id"),
    recallBotStatus: text("recall_bot_status"),
    recallCallId: text("recall_call_id"),
    recallMeetingUrl: text("recall_meeting_url"),
    participants: jsonb("participants"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("transcripts_organization_id_idx").on(
      table.organizationId,
    ),
    dealIdx: index("transcripts_deal_id_idx").on(table.dealId),
    createdByIdx: index("transcripts_created_by_idx").on(table.createdBy),
  }),
);

export const systemWorkflowConfigs = pgTable("system_workflow_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowType: text("workflow_type").notNull().unique(),
  n8nWebhookUrl: text("n8n_webhook_url").notNull(),
  n8nWorkflowId: text("n8n_workflow_id"),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const billingConnections = pgTable(
  "billing_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    authType: text("auth_type").notNull(),
    status: text("status").default("connected").notNull(),
    encryptedCredentials: jsonb("encrypted_credentials").notNull(),
    providerAccountId: text("provider_account_id"),
    metadata: jsonb("metadata").default({}).notNull(),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("billing_connections_organization_id_idx").on(
      table.organizationId,
    ),
    providerIdx: index("billing_connections_provider_idx").on(table.provider),
    statusIdx: index("billing_connections_status_idx").on(table.status),
    orgProviderUnique: uniqueIndex(
      "billing_connections_org_provider_unique",
    ).on(table.organizationId, table.provider),
  }),
);

export const billingDocuments = pgTable(
  "billing_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    workflowRunId: uuid("workflow_run_id").references(() => workflowRuns.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull(),
    documentType: text("document_type").default("quote").notNull(),
    providerClientId: text("provider_client_id"),
    providerQuoteId: text("provider_quote_id"),
    providerQuoteNumber: text("provider_quote_number"),
    providerQuoteUrl: text("provider_quote_url"),
    providerStatus: text("provider_status"),
    amountHt: numeric("amount_ht", { mode: "number" }),
    amountTva: numeric("amount_tva", { mode: "number" }),
    amountTtc: numeric("amount_ttc", { mode: "number" }),
    currency: text("currency").default("EUR").notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("billing_documents_organization_id_idx").on(
      table.organizationId,
    ),
    dealIdx: index("billing_documents_deal_id_idx").on(table.dealId),
    workflowRunIdx: index("billing_documents_workflow_run_id_idx").on(
      table.workflowRunId,
    ),
    providerIdx: index("billing_documents_provider_idx").on(table.provider),
    providerQuoteIdIdx: index("billing_documents_provider_quote_id_idx").on(
      table.providerQuoteId,
    ),
    documentTypeIdx: index("billing_documents_document_type_idx").on(
      table.documentType,
    ),
    createdAtIdx: index("billing_documents_created_at_idx").on(table.createdAt),
    providerQuoteIdUnique: uniqueIndex(
      "billing_documents_provider_quote_id_unique",
    )
      .on(table.provider, table.providerQuoteId)
      .where(sql`${table.providerQuoteId} IS NOT NULL`),
  }),
);

export const brokerClients = pgTable(
  "broker_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull(),
    clientType: text("client_type").default("individual").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    companyName: text("company_name"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    postalCode: text("postal_code"),
    city: text("city"),
    dateOfBirth: date("date_of_birth"),
    birthCountry: text("birth_country"),
    insuranceType: text("insurance_type"),
    status: text("status").default("new").notNull(),
    needs: text("needs"),
    structuredNeeds: jsonb("structured_needs").default({}).notNull(),
    notes: text("notes"),
    introducerId: uuid("introducer_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("broker_clients_organization_id_idx").on(
      table.organizationId,
    ),
    statusIdx: index("broker_clients_status_idx").on(table.status),
    createdByIdx: index("broker_clients_created_by_idx").on(table.createdBy),
    archivedAtIdx: index("broker_clients_archived_at_idx").on(table.archivedAt),
  }),
);

export const brokerActivity = pgTable(
  "broker_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => brokerClients.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    type: text("type").notNull(),
    description: text("description"),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("broker_activity_organization_id_idx").on(
      table.organizationId,
    ),
    clientIdx: index("broker_activity_client_id_idx").on(table.clientId),
    createdAtIdx: index("broker_activity_created_at_idx").on(table.createdAt),
  }),
);

export const brokerDocuments = pgTable(
  "broker_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => brokerClients.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by").notNull(),
    category: text("category").default("other").notNull(),
    title: text("title").notNull(),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).default(0).notNull(),
    status: text("status").default("stored").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("broker_documents_organization_id_idx").on(
      table.organizationId,
    ),
    clientIdx: index("broker_documents_client_id_idx").on(table.clientId),
    categoryIdx: index("broker_documents_category_idx").on(table.category),
    createdAtIdx: index("broker_documents_created_at_idx").on(table.createdAt),
  }),
);

export const brokerQuotes = pgTable(
  "broker_quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => brokerClients.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => brokerDocuments.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").notNull(),
    insurerName: text("insurer_name"),
    productName: text("product_name"),
    premiumMonthly: numeric("premium_monthly", { mode: "number" }),
    premiumAnnual: numeric("premium_annual", { mode: "number" }),
    currency: text("currency").default("EUR").notNull(),
    coverageSummary: text("coverage_summary"),
    deductible: text("deductible"),
    vigilancePoints: text("vigilance_points"),
    otherInfo: text("other_info"),
    notes: text("notes"),
    extractedData: jsonb("extracted_data").default({}).notNull(),
    extractionStatus: text("extraction_status").default("pending").notNull(),
    validatedBy: uuid("validated_by"),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("broker_quotes_organization_id_idx").on(
      table.organizationId,
    ),
    clientIdx: index("broker_quotes_client_id_idx").on(table.clientId),
    documentIdx: index("broker_quotes_document_id_idx").on(table.documentId),
    statusIdx: index("broker_quotes_status_idx").on(table.extractionStatus),
  }),
);

export const brokerAdvice = pgTable(
  "broker_advice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => brokerClients.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").references(() => brokerQuotes.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").notNull(),
    title: text("title").default("Devoir de conseil").notNull(),
    content: text("content").default("").notNull(),
    requirements: text("requirements"),
    status: text("status").default("draft").notNull(),
    docusealSubmissionId: text("docuseal_submission_id"),
    signatureStatus: text("signature_status"),
    signatureUrl: text("signature_url"),
    outlookDraftId: text("outlook_draft_id"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    validatedBy: uuid("validated_by"),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("broker_advice_organization_id_idx").on(
      table.organizationId,
    ),
    clientIdx: index("broker_advice_client_id_idx").on(table.clientId),
    quoteIdx: index("broker_advice_quote_id_idx").on(table.quoteId),
    statusIdx: index("broker_advice_status_idx").on(table.status),
  }),
);

export const brokerContracts = pgTable(
  "broker_contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => brokerClients.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull(),
    documentId: uuid("document_id").references(() => brokerDocuments.id, {
      onDelete: "set null",
    }),
    insurerName: text("insurer_name"),
    productName: text("product_name"),
    insuranceType: text("insurance_type"),
    policyNumber: text("policy_number"),
    status: text("status").default("active").notNull(),
    effectiveDate: date("effective_date"),
    renewalDate: date("renewal_date"),
    premiumAmount: numeric("premium_amount", { mode: "number" }),
    premiumFrequency: text("premium_frequency").default("annual").notNull(),
    currency: text("currency").default("EUR").notNull(),
    tacitRenewal: boolean("tacit_renewal").default(true).notNull(),
    commissionRate: numeric("commission_rate", { mode: "number" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("broker_contracts_organization_id_idx").on(
      table.organizationId,
    ),
    clientIdx: index("broker_contracts_client_id_idx").on(table.clientId),
    statusIdx: index("broker_contracts_status_idx").on(table.status),
    renewalDateIdx: index("broker_contracts_renewal_date_idx").on(
      table.renewalDate,
    ),
  }),
);

export const brokerCompliance = pgTable(
  "broker_compliance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => brokerClients.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),
    identityVerified: boolean("identity_verified").default(false).notNull(),
    identityDocumentId: uuid("identity_document_id").references(
      () => brokerDocuments.id,
      { onDelete: "set null" },
    ),
    identityVerifiedAt: timestamp("identity_verified_at", {
      withTimezone: true,
    }),
    identityVerifiedBy: uuid("identity_verified_by"),
    riskLevel: text("risk_level"),
    isPep: boolean("is_pep").default(false).notNull(),
    pepDetails: text("pep_details"),
    fundsOrigin: text("funds_origin"),
    lcbftNotes: text("lcbft_notes"),
    consentDataProcessing: boolean("consent_data_processing")
      .default(false)
      .notNull(),
    consentDataProcessingAt: timestamp("consent_data_processing_at", {
      withTimezone: true,
    }),
    consentMarketing: boolean("consent_marketing").default(false).notNull(),
    consentMarketingAt: timestamp("consent_marketing_at", {
      withTimezone: true,
    }),
    erasureRequested: boolean("erasure_requested").default(false).notNull(),
    erasureRequestedAt: timestamp("erasure_requested_at", {
      withTimezone: true,
    }),
    erasedAt: timestamp("erased_at", { withTimezone: true }),
    infoSheetDelivered: boolean("info_sheet_delivered")
      .default(false)
      .notNull(),
    infoSheetDeliveredAt: timestamp("info_sheet_delivered_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("broker_compliance_organization_id_idx").on(
      table.organizationId,
    ),
    clientUniq: uniqueIndex("broker_compliance_client_uniq").on(
      table.organizationId,
      table.clientId,
    ),
  }),
);

export const brokerCommissionStatements = pgTable(
  "broker_commission_statements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull(),
    documentId: uuid("document_id").references(() => brokerDocuments.id, {
      onDelete: "set null",
    }),
    insurerName: text("insurer_name"),
    periodLabel: text("period_label"),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    totalAmount: numeric("total_amount", { mode: "number" }),
    currency: text("currency").default("EUR").notNull(),
    status: text("status").default("received").notNull(),
    notes: text("notes"),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    reconciledBy: uuid("reconciled_by"),
    sourceStoragePath: text("source_storage_path"),
    sourceFileName: text("source_file_name"),
    sourceMimeType: text("source_mime_type"),
    sourceSizeBytes: bigint("source_size_bytes", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index(
      "broker_commission_statements_organization_id_idx",
    ).on(table.organizationId),
    statusIdx: index("broker_commission_statements_status_idx").on(
      table.status,
    ),
  }),
);

export const brokerCommissions = pgTable(
  "broker_commissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull(),
    statementId: uuid("statement_id").references(
      () => brokerCommissionStatements.id,
      { onDelete: "set null" },
    ),
    contractId: uuid("contract_id").references(() => brokerContracts.id, {
      onDelete: "set null",
    }),
    clientId: uuid("client_id").references(() => brokerClients.id, {
      onDelete: "set null",
    }),
    insurerName: text("insurer_name"),
    label: text("label"),
    baseAmount: numeric("base_amount", { mode: "number" }),
    rate: numeric("rate", { mode: "number" }),
    commissionAmount: numeric("commission_amount", { mode: "number" }),
    retrocessionRate: numeric("retrocession_rate", { mode: "number" }),
    retrocessionAmount: numeric("retrocession_amount", { mode: "number" }),
    retrocessionBeneficiary: text("retrocession_beneficiary"),
    introducerId: uuid("introducer_id"),
    periodLabel: text("period_label"),
    currency: text("currency").default("EUR").notNull(),
    status: text("status").default("expected").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("broker_commissions_organization_id_idx").on(
      table.organizationId,
    ),
    statementIdx: index("broker_commissions_statement_id_idx").on(
      table.statementId,
    ),
    contractIdx: index("broker_commissions_contract_id_idx").on(
      table.contractId,
    ),
    clientIdx: index("broker_commissions_client_id_idx").on(table.clientId),
    statusIdx: index("broker_commissions_status_idx").on(table.status),
  }),
);

export const brokerIntroducers = pgTable(
  "broker_introducers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull(),
    name: text("name").notNull(),
    retrocessionRate: numeric("retrocession_rate", { mode: "number" }),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("broker_introducers_organization_id_idx").on(
      table.organizationId,
    ),
    archivedAtIdx: index("broker_introducers_archived_at_idx").on(
      table.archivedAt,
    ),
  }),
);

export const brokerClaims = pgTable(
  "broker_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => brokerClients.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id").references(() => brokerContracts.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").notNull(),
    insurerName: text("insurer_name"),
    claimType: text("claim_type"),
    reference: text("reference"),
    status: text("status").default("declared").notNull(),
    occurrenceDate: date("occurrence_date"),
    declarationDate: date("declaration_date"),
    amountEstimate: numeric("amount_estimate", { mode: "number" }),
    amountSettled: numeric("amount_settled", { mode: "number" }),
    currency: text("currency").default("EUR").notNull(),
    description: text("description"),
    notes: text("notes"),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("broker_claims_organization_id_idx").on(
      table.organizationId,
    ),
    clientIdx: index("broker_claims_client_id_idx").on(table.clientId),
    contractIdx: index("broker_claims_contract_id_idx").on(table.contractId),
    statusIdx: index("broker_claims_status_idx").on(table.status),
  }),
);

export const brokerEmailDigests = pgTable(
  "broker_email_digests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    status: text("status").default("ready").notNull(),
    narrative: text("narrative"),
    windowStart: timestamp("window_start", { withTimezone: true }),
    windowEnd: timestamp("window_end", { withTimezone: true }),
    relevantCount: integer("relevant_count").default(0).notNull(),
    excludedCount: integer("excluded_count").default(0).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgUserIdx: index("broker_email_digests_org_user_idx").on(
      table.organizationId,
      table.userId,
    ),
  }),
);

export const brokerEmailItems = pgTable(
  "broker_email_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    digestId: uuid("digest_id")
      .notNull()
      .references(() => brokerEmailDigests.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    graphMessageId: text("graph_message_id").notNull(),
    fromName: text("from_name"),
    fromEmail: text("from_email"),
    subject: text("subject"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    webLink: text("web_link"),
    mailboxAddress: text("mailbox_address"),
    category: text("category"),
    summary: text("summary"),
    urgency: text("urgency").default("normal").notNull(),
    relevance: text("relevance").default("relevant").notNull(),
    exclusionReason: text("exclusion_reason"),
    suggestedClientId: uuid("suggested_client_id").references(
      () => brokerClients.id,
      { onDelete: "set null" },
    ),
    hasAttachments: boolean("has_attachments").default(false).notNull(),
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    digestIdx: index("broker_email_items_digest_idx").on(table.digestId),
    userMessageIdx: index("broker_email_items_user_message_idx").on(
      table.organizationId,
      table.userId,
      table.graphMessageId,
    ),
  }),
);

export const brokerEmailSuggestions = pgTable(
  "broker_email_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => brokerEmailItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    type: text("type").notNull(),
    status: text("status").default("pending").notNull(),
    confidence: text("confidence"),
    payload: jsonb("payload").default({}).notNull(),
    result: jsonb("result").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    itemIdx: index("broker_email_suggestions_item_idx").on(table.itemId),
  }),
);

// ---------------------------------------------------------------------------
// Portfolio import (reprise CRM) — staged files classified by AI, regrouped
// into proposed client dossiers, reviewed, then committed. See migration 0053.
// ---------------------------------------------------------------------------
export const brokerImportBatches = pgTable(
  "broker_import_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull(),
    sourceType: text("source_type").default("folder").notNull(),
    status: text("status").default("uploading").notNull(),
    fileCount: integer("file_count").default(0).notNull(),
    analyzedCount: integer("analyzed_count").default(0).notNull(),
    groupCount: integer("group_count").default(0).notNull(),
    narrative: text("narrative"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    organizationIdx: index("broker_import_batches_organization_id_idx").on(
      table.organizationId,
    ),
    statusIdx: index("broker_import_batches_status_idx").on(table.status),
    createdAtIdx: index("broker_import_batches_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

export const brokerImportGroups = pgTable(
  "broker_import_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => brokerImportBatches.id, { onDelete: "cascade" }),
    matchClientId: uuid("match_client_id").references(() => brokerClients.id, {
      onDelete: "set null",
    }),
    clientType: text("client_type").default("individual").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    companyName: text("company_name"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    postalCode: text("postal_code"),
    city: text("city"),
    insuranceType: text("insurance_type"),
    needs: text("needs"),
    confidence: numeric("confidence", { mode: "number" }),
    status: text("status").default("pending").notNull(),
    createdClientId: uuid("created_client_id").references(
      () => brokerClients.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("broker_import_groups_organization_id_idx").on(
      table.organizationId,
    ),
    batchIdx: index("broker_import_groups_batch_id_idx").on(table.batchId),
    statusIdx: index("broker_import_groups_status_idx").on(table.status),
  }),
);

export const brokerImportFiles = pgTable(
  "broker_import_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => brokerImportBatches.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => brokerImportGroups.id, {
      onDelete: "set null",
    }),
    uploadedBy: uuid("uploaded_by").notNull(),
    originalPath: text("original_path").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).default(0).notNull(),
    storagePath: text("staging_path").notNull(),
    analysisStatus: text("analysis_status").default("pending").notNull(),
    extracted: jsonb("extracted").default({}).notNull(),
    decision: text("decision").default("include").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("broker_import_files_organization_id_idx").on(
      table.organizationId,
    ),
    batchIdx: index("broker_import_files_batch_id_idx").on(table.batchId),
    groupIdx: index("broker_import_files_group_id_idx").on(table.groupId),
    analysisStatusIdx: index("broker_import_files_analysis_status_idx").on(
      table.analysisStatus,
    ),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("audit_logs_organization_id_idx").on(
      table.organizationId,
    ),
    actionIdx: index("audit_logs_action_idx").on(table.action),
  }),
);
