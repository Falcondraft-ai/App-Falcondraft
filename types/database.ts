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
  billing_status: string;
  allow_member_company_visibility: boolean;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  created_at: string;
};

export type OrganizationMemberRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: "manager" | "member" | "viewer" | string;
  status: "active" | "inactive" | "invited" | string;
  created_at: string;
};

export type OrganizationInvitationRow = {
  id: string;
  organization_id: string;
  email: string;
  role: "manager" | "member" | "viewer" | string;
  invited_by: string;
  token_hash: string;
  status: "pending" | "accepted" | "expired" | "revoked" | string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DealRow = {
  id: string;
  organization_id: string;
  name: string;
  client_company_name: string;
  client_contact_name: string | null;
  client_email: string | null;
  status: string;
  transcript: string | null;
  additional_context: string | null;
  email_instructions: string | null;
  client_phone: string | null;
  client_company_info: string | null;
  call_summary: string | null;
  proposal_content: string | null;
  quote_context: string | null;
  amount_estimate: number | null;
  expected_close_date: string | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowRunRow = {
  id: string;
  organization_id: string;
  deal_id: string;
  type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
};

export type DocumentRow = {
  id: string;
  organization_id: string;
  deal_id: string;
  type: string;
  title: string;
  url: string | null;
  storage_path: string | null;
  external_id: string | null;
  status: string;
  created_at: string;
};

export type IntegrationRow = {
  id: string;
  organization_id: string;
  provider: string;
  status: string;
  connected_email: string | null;
  created_at: string;
};

export type BillingSubscriptionRow = {
  id: string;
  organization_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  plan: string | null;
  current_period_end: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
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
      organizations: TableDefinition<
        OrganizationRow,
        {
          id?: string;
          name: string;
          slug: string;
          billing_status?: string;
          allow_member_company_visibility?: boolean;
          created_at?: string;
        },
        {
          id?: string;
          name?: string;
          slug?: string;
          billing_status?: string;
          allow_member_company_visibility?: boolean;
          created_at?: string;
        }
      >;

      profiles: TableDefinition<
        ProfileRow,
        {
          id?: string;
          user_id: string;
          full_name?: string | null;
          email: string;
          created_at?: string;
        }
      >;

      organization_members: TableDefinition<
        OrganizationMemberRow,
        {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: string;
          status?: string;
          created_at?: string;
        }
      >;

      organization_invitations: TableDefinition<
        OrganizationInvitationRow,
        {
          id?: string;
          organization_id: string;
          email: string;
          role?: string;
          invited_by: string;
          token_hash: string;
          status?: string;
          expires_at: string;
          accepted_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;

      deals: TableDefinition<
        DealRow,
        {
          id?: string;
          organization_id: string;
          name: string;
          client_company_name: string;
          client_contact_name?: string | null;
          client_email?: string | null;
          status?: string;
          transcript?: string | null;
          additional_context?: string | null;
          email_instructions?: string | null;
          client_phone?: string | null;
          client_company_info?: string | null;
          call_summary?: string | null;
          proposal_content?: string | null;
          quote_context?: string | null;
          amount_estimate?: number | null;
          expected_close_date?: string | null;
          archived_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;

      workflow_runs: TableDefinition<
        WorkflowRunRow,
        {
          id?: string;
          organization_id: string;
          deal_id: string;
          type: string;
          status?: string;
          started_at?: string | null;
          completed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        }
      >;

      documents: TableDefinition<
        DocumentRow,
        {
          id?: string;
          organization_id: string;
          deal_id: string;
          type: string;
          title: string;
          url?: string | null;
          storage_path?: string | null;
          external_id?: string | null;
          status?: string;
          created_at?: string;
        }
      >;

      integrations: TableDefinition<
        IntegrationRow,
        {
          id?: string;
          organization_id: string;
          provider: string;
          status?: string;
          connected_email?: string | null;
          created_at?: string;
        }
      >;

      billing_subscriptions: TableDefinition<
        BillingSubscriptionRow,
        {
          id?: string;
          organization_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          status?: string;
          plan?: string | null;
          current_period_end?: string | null;
          created_at?: string;
        }
      >;

      audit_logs: TableDefinition<
        AuditLogRow,
        {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          created_at?: string;
        }
      >;

      workflow_configs: TableDefinition<
        WorkflowConfigRow,
        {
          id?: string;
          organization_id: string;
          workflow_type: string;
          n8n_webhook_url: string;
          n8n_workflow_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
