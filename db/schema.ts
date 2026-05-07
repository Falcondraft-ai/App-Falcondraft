import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const organizationRole = pgEnum("organization_role", [
  "owner",
  "admin",
  "member",
]);
export const dealStatus = pgEnum("deal_status", [
  "draft",
  "generating",
  "review",
  "sent",
  "won",
  "lost",
]);
export const workflowRunStatus = pgEnum("workflow_run_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export const documentKind = pgEnum("document_kind", [
  "summary",
  "proposal",
  "presentation",
  "quote",
  "pdf",
  "signature",
  "email",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  billingEmail: text("billing_email"),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  ...timestamps,
});

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fullName: text("full_name"),
    email: text("email").notNull(),
    avatarUrl: text("avatar_url"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: index("profiles_organization_id_idx").on(
      table.organizationId,
    ),
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
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: organizationRole("role").default("member").notNull(),
    invitedEmail: text("invited_email"),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: index("organization_members_organization_id_idx").on(
      table.organizationId,
    ),
    memberUniqueIdx: uniqueIndex("organization_members_profile_unique_idx").on(
      table.organizationId,
      table.profileId,
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
    ownerProfileId: uuid("owner_profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name"),
    status: dealStatus("status").default("draft").notNull(),
    sourceNotes: text("source_notes"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: index("deals_organization_id_idx").on(
      table.organizationId,
    ),
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
    status: workflowRunStatus("status").default("queued").notNull(),
    safeStatusMessage: text("safe_status_message"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
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
    workflowRunId: uuid("workflow_run_id").references(() => workflowRuns.id, {
      onDelete: "set null",
    }),
    kind: documentKind("kind").notNull(),
    title: text("title").notNull(),
    storagePath: text("storage_path"),
    externalUrl: text("external_url"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: index("documents_organization_id_idx").on(
      table.organizationId,
    ),
    dealIdx: index("documents_deal_id_idx").on(table.dealId),
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
    label: text("label").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationProviderIdx: uniqueIndex(
      "integrations_organization_provider_idx",
    ).on(table.organizationId, table.provider),
  }),
);

export const gmailConnections = pgTable(
  "gmail_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    connected: boolean("connected").default(false).notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: index("gmail_connections_organization_id_idx").on(
      table.organizationId,
    ),
    profileIdx: index("gmail_connections_profile_id_idx").on(table.profileId),
  }),
);

export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    priceId: text("price_id"),
    customerId: text("customer_id"),
    subscriptionId: text("subscription_id"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: uniqueIndex(
      "billing_subscriptions_organization_id_idx",
    ).on(table.organizationId),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorProfileId: uuid("actor_profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    organizationIdx: index("audit_logs_organization_id_idx").on(
      table.organizationId,
    ),
    actionIdx: index("audit_logs_action_idx").on(table.action),
  }),
);

// RLS policy principle for future migrations:
// each tenant-scoped table above must restrict reads/writes to authenticated members
// whose membership row matches organization_id. Service-role automations should use
// narrow server-only paths and never expose privileged keys to the browser.
