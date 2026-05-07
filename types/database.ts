export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  billing_email: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  organization_id: string | null;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type OrganizationMemberRow = {
  id: string;
  organization_id: string;
  profile_id: string;
  role: "owner" | "admin" | "member" | string;
  invited_email: string | null;
  created_at: string;
  updated_at: string;
};

export type DealRow = {
  id: string;
  organization_id: string;
  owner_profile_id: string | null;
  title: string;
  company_name: string;
  contact_name: string | null;
  status: string;
  source_notes: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type WorkflowRunRow = {
  id: string;
  organization_id: string;
  deal_id: string;
  type: string;
  status: string;
  safe_status_message: string | null;
  metadata: Json;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentRow = {
  id: string;
  organization_id: string;
  deal_id: string;
  workflow_run_id: string | null;
  kind: string;
  title: string;
  storage_path: string | null;
  external_url: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type IntegrationRow = {
  id: string;
  organization_id: string;
  provider: string;
  label: string;
  enabled: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type BillingSubscriptionRow = {
  id: string;
  organization_id: string;
  status: string;
  price_id: string | null;
  customer_id: string | null;
  subscription_id: string | null;
  current_period_end: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type AuditLogRow = {
  id: string;
  organization_id: string;
  actor_profile_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Json;
  created_at: string;
};

export type WorkflowConfigRow = {
  id: string;
  organization_id: string;
  workflow_type: string;
  n8n_webhook_url: string;
  n8n_workflow_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      organizations: TableDefinition<OrganizationRow>;
      profiles: TableDefinition<ProfileRow>;
      organization_members: TableDefinition<OrganizationMemberRow>;
      deals: TableDefinition<
        DealRow,
        {
          id?: string;
          organization_id: string;
          owner_profile_id?: string | null;
          title: string;
          company_name: string;
          contact_name?: string | null;
          status?: string;
          source_notes?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      workflow_runs: TableDefinition<WorkflowRunRow>;
      documents: TableDefinition<DocumentRow>;
      integrations: TableDefinition<IntegrationRow>;
      billing_subscriptions: TableDefinition<BillingSubscriptionRow>;
      audit_logs: TableDefinition<AuditLogRow>;
      workflow_configs: TableDefinition<WorkflowConfigRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
