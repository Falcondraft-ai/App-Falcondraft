import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  billingStatus: text("billing_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    fullName: text("full_name"),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: uniqueIndex("profiles_user_id_idx").on(table.userId),
    emailIdx: uniqueIndex("profiles_email_idx").on(table.email),
  }),
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
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("deals_organization_id_idx").on(table.organizationId),
    statusIdx: index("deals_status_idx").on(table.status),
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
