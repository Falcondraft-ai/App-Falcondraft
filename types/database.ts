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
  setup_amount: number | null;
  monthly_subscription_amount: number | null;
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

export type EmailConnectionRow = {
  id: string;
  organization_id: string;
  user_id: string;
  provider: "gmail" | string;
  email: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  status: "connected" | "disconnected" | "error" | string;
  created_at: string;
  updated_at: string;
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

export type SystemWorkflowConfigRow = {
  id: string;
  workflow_type: string;
  n8n_webhook_url: string;
  n8n_workflow_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type TranscriptRow = {
  id: string;
  organization_id: string;
  created_by: string;
  deal_id: string | null;
  title: string;
  source: string;
  status: string;
  language: string | null;
  transcript_text: string | null;
  audio_storage_path: string | null;
  recall_bot_id: string | null;
  recall_bot_status: string | null;
  recall_call_id: string | null;
  recall_meeting_url: string | null;
  participants: unknown[] | null;
  started_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProspectCompanyRow = {
  id: string;
  organization_id: string;
  source: string | null;
  google_place_id: string | null;
  name: string;
  name_normalized: string | null;
  website: string | null;
  website_domain: string | null;
  phone: string | null;
  formatted_address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  google_primary_type: string | null;
  google_primary_type_display_name: string | null;
  google_types: unknown | null;
  rating: number | null;
  user_rating_count: number | null;
  niche: string | null;
  category_query: string | null;
  source_search_id: string | null;
  fit_score: number | null;
  priority: string | null;
  reason_for_fit: string | null;
  recommended_angle: string | null;
  status: string;
  owner_user_id: string | null;
  last_called_at: string | null;
  last_contacted_at: string | null;
  next_action_at: string | null;
  assigned_closer: string | null;
  meeting_url: string | null;
  meeting_platform: string | null;
  meeting_at: string | null;
  raw_google_data: unknown | null;
  created_at: string;
  updated_at: string;
};

export type ProspectingSearchRow = {
  id: string;
  organization_id: string;
  created_by: string | null;
  name: string;
  niche: string | null;
  category_query: string | null;
  scope_type: string | null;
  location_query: string | null;
  status: string;
  max_results: number | null;
  run_mode: string | null;
  run_frequency: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  notes: string | null;
  include_keywords: string | null;
  exclude_keywords: string | null;
  created_at: string;
  updated_at: string;
};

export type ProspectSearchResultRow = {
  id: string;
  organization_id: string;
  search_id: string;
  source: string | null;
  google_place_id: string | null;
  name: string;
  name_normalized: string | null;
  website: string | null;
  website_domain: string | null;
  phone: string | null;
  formatted_address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  google_primary_type: string | null;
  google_primary_type_display_name: string | null;
  google_types: unknown | null;
  rating: number | null;
  user_rating_count: number | null;
  niche: string | null;
  category_query: string | null;
  fit_score: number | null;
  priority: string | null;
  reason_for_fit: string | null;
  recommended_angle: string | null;
  lead_summary: string | null;
  review_status: string;
  include_keywords: string | null;
  exclude_keywords: string | null;
  raw_google_data: unknown | null;
  created_at: string;
  updated_at: string;
};

export type ProspectTaskRow = {
  id: string;
  organization_id: string;
  company_id: string | null;
  contact_id: string | null;
  title: string;
  description: string | null;
  type: string;
  status: string;
  assigned_to: string | null;
  due_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProspectContactRow = {
  id: string;
  organization_id: string;
  company_id: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  linkedin_url: string | null;
  source: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ProspectInteractionRow = {
  id: string;
  organization_id: string;
  company_id: string | null;
  contact_id: string | null;
  type: string;
  channel: string;
  content: string | null;
  result: string;
  created_by: string | null;
  created_at: string;
};

export type ProspectDocumentRow = {
  id: string;
  organization_id: string;
  company_id: string;
  uploaded_by: string;
  document_type: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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
          setup_amount?: number | null;
          monthly_subscription_amount?: number | null;
          allow_member_company_visibility?: boolean;
          created_at?: string;
        },
        {
          id?: string;
          name?: string;
          slug?: string;
          billing_status?: string;
          setup_amount?: number | null;
          monthly_subscription_amount?: number | null;
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

      email_connections: TableDefinition<
        EmailConnectionRow,
        {
          id?: string;
          organization_id: string;
          user_id: string;
          provider: string;
          email: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          organization_id?: string;
          user_id?: string;
          provider?: string;
          email?: string;
          access_token?: string;
          refresh_token?: string;
          expires_at?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
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

      system_workflow_configs: TableDefinition<
        SystemWorkflowConfigRow,
        {
          id?: string;
          workflow_type: string;
          n8n_webhook_url: string;
          n8n_workflow_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          workflow_type?: string;
          n8n_webhook_url?: string;
          n8n_workflow_id?: string | null;
          status?: string;
          updated_at?: string;
        }
      >;

      transcripts: TableDefinition<
        TranscriptRow,
        {
          id?: string;
          organization_id: string;
          created_by: string;
          deal_id?: string | null;
          title: string;
          source?: string;
          status?: string;
          language?: string | null;
          transcript_text?: string | null;
          audio_storage_path?: string | null;
          recall_bot_id?: string | null;
          recall_bot_status?: string | null;
          recall_call_id?: string | null;
          recall_meeting_url?: string | null;
          participants?: unknown[] | null;
          started_at?: string | null;
          duration_seconds?: number | null;
          error_message?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;

      prospect_companies: TableDefinition<
        ProspectCompanyRow,
        {
          id?: string;
          organization_id: string;
          source?: string | null;
          google_place_id?: string | null;
          name: string;
          name_normalized?: string | null;
          website?: string | null;
          website_domain?: string | null;
          phone?: string | null;
          formatted_address?: string | null;
          city?: string | null;
          region?: string | null;
          country?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          google_primary_type?: string | null;
          google_primary_type_display_name?: string | null;
          google_types?: unknown | null;
          rating?: number | null;
          user_rating_count?: number | null;
          niche?: string | null;
          category_query?: string | null;
          source_search_id?: string | null;
          fit_score?: number | null;
          priority?: string | null;
          reason_for_fit?: string | null;
          recommended_angle?: string | null;
          status?: string;
          owner_user_id?: string | null;
          last_called_at?: string | null;
          last_contacted_at?: string | null;
          next_action_at?: string | null;
          assigned_closer?: string | null;
          meeting_url?: string | null;
          meeting_platform?: string | null;
          meeting_at?: string | null;
          raw_google_data?: unknown | null;
          created_at?: string;
          updated_at?: string;
        }
      >;

      prospecting_searches: TableDefinition<
        ProspectingSearchRow,
        {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          name: string;
          niche?: string | null;
          category_query?: string | null;
          scope_type?: string | null;
          location_query?: string | null;
          status?: string;
          max_results?: number | null;
          run_mode?: string | null;
          run_frequency?: string | null;
          last_run_at?: string | null;
          next_run_at?: string | null;
          notes?: string | null;
          include_keywords?: string | null;
          exclude_keywords?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;

      prospect_search_results: TableDefinition<
        ProspectSearchResultRow,
        {
          id?: string;
          organization_id: string;
          search_id: string;
          source?: string | null;
          google_place_id?: string | null;
          name: string;
          name_normalized?: string | null;
          website?: string | null;
          website_domain?: string | null;
          phone?: string | null;
          formatted_address?: string | null;
          city?: string | null;
          region?: string | null;
          country?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          google_primary_type?: string | null;
          google_primary_type_display_name?: string | null;
          google_types?: unknown | null;
          rating?: number | null;
          user_rating_count?: number | null;
          niche?: string | null;
          category_query?: string | null;
          fit_score?: number | null;
          priority?: string | null;
          reason_for_fit?: string | null;
          recommended_angle?: string | null;
          lead_summary?: string | null;
          review_status?: string;
          include_keywords?: string | null;
          exclude_keywords?: string | null;
          raw_google_data?: unknown | null;
          created_at?: string;
          updated_at?: string;
        }
      >;

      prospect_tasks: TableDefinition<
        ProspectTaskRow,
        {
          id?: string;
          organization_id: string;
          company_id?: string | null;
          contact_id?: string | null;
          title: string;
          description?: string | null;
          type?: string;
          status?: string;
          assigned_to?: string | null;
          due_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;

      prospect_interactions: TableDefinition<
        ProspectInteractionRow,
        {
          id?: string;
          organization_id: string;
          company_id?: string | null;
          contact_id?: string | null;
          type: string;
          channel: string;
          content?: string | null;
          result: string;
          created_by?: string | null;
          created_at?: string;
        }
      >;

      prospect_contacts: TableDefinition<
        ProspectContactRow,
        {
          id?: string;
          organization_id: string;
          company_id?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          job_title?: string | null;
          email?: string | null;
          email_status?: string | null;
          phone?: string | null;
          linkedin_url?: string | null;
          source?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;

      prospect_documents: TableDefinition<
        ProspectDocumentRow,
        {
          id?: string;
          organization_id: string;
          company_id: string;
          uploaded_by: string;
          document_type?: string;
          file_name: string;
          file_path: string;
          mime_type: string;
          size_bytes: number;
          status?: string;
          deleted_at?: string | null;
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
