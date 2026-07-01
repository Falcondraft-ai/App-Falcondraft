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
  default_quote_client_type: string;
  default_quote_tax_rate: number;
  default_billing_provider: string;
  meeting_bot_name: string;
  workspace_type: "sales_automation" | "insurance_broker" | string;
  broker_offering: "saas" | "custom" | string;
  plan: "essentiel" | "cabinet" | "performance" | null;
  plan_seats: number | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  storage_limit_bytes: number;
  storage_used_bytes: number;
  broker_settings: Record<string, unknown>;
  created_at: string;
};

export type WorkspaceType = "sales_automation" | "insurance_broker";

export type BrokerOffering = "saas" | "custom";

export type Plan = "essentiel" | "cabinet" | "performance";

export type BrokerClientRow = {
  id: string;
  organization_id: string;
  created_by: string;
  client_type: "individual" | "company" | string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  date_of_birth: string | null;
  insurance_type: string | null;
  status:
    | "new"
    | "in_progress"
    | "advice_ready"
    | "awaiting_signature"
    | "signed"
    | "closed"
    | "lost"
    | string;
  needs: string | null;
  structured_needs: Record<string, unknown>;
  notes: string | null;
  introducer_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BrokerActivityRow = {
  id: string;
  organization_id: string;
  client_id: string;
  user_id: string | null;
  type: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type BrokerDocumentRow = {
  id: string;
  organization_id: string;
  client_id: string;
  uploaded_by: string;
  category:
    | "contract"
    | "id_document"
    | "rib"
    | "company_quote"
    | "advice_document"
    | "other"
    | string;
  title: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type BrokerAgentMessageRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: "user" | "assistant" | string;
  content: string;
  created_at: string;
};

export type BrokerAdviceRow = {
  id: string;
  organization_id: string;
  client_id: string;
  quote_id: string | null;
  created_by: string;
  title: string;
  content: string;
  status: "draft" | "validated" | "sent_for_signature" | "signed" | string;
  docuseal_submission_id: string | null;
  signature_status: string | null;
  signature_url: string | null;
  outlook_draft_id: string | null;
  generated_at: string | null;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BrokerQuoteRow = {
  id: string;
  organization_id: string;
  client_id: string;
  document_id: string | null;
  created_by: string;
  insurer_name: string | null;
  product_name: string | null;
  premium_monthly: number | null;
  premium_annual: number | null;
  currency: string;
  coverage_summary: string | null;
  deductible: string | null;
  vigilance_points: string | null;
  other_info: string | null;
  notes: string | null;
  extracted_data: Record<string, unknown>;
  extraction_status: "pending" | "extracted" | "validated" | "failed" | string;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BrokerIntroducerRow = {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  retrocession_rate: number | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BrokerContractRow = {
  id: string;
  organization_id: string;
  client_id: string;
  created_by: string;
  document_id: string | null;
  insurer_name: string | null;
  product_name: string | null;
  insurance_type: string | null;
  policy_number: string | null;
  status:
    | "active"
    | "pending"
    | "suspended"
    | "terminated"
    | "expired"
    | string;
  effective_date: string | null;
  renewal_date: string | null;
  premium_amount: number | null;
  premium_frequency:
    | "monthly"
    | "quarterly"
    | "biannual"
    | "annual"
    | "single"
    | string;
  currency: string;
  tacit_renewal: boolean;
  commission_rate: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BrokerComplianceRow = {
  id: string;
  organization_id: string;
  client_id: string;
  created_by: string;
  updated_by: string | null;
  identity_verified: boolean;
  identity_document_id: string | null;
  identity_verified_at: string | null;
  identity_verified_by: string | null;
  risk_level: "low" | "standard" | "high" | null;
  is_pep: boolean;
  pep_details: string | null;
  funds_origin: string | null;
  lcbft_notes: string | null;
  consent_data_processing: boolean;
  consent_data_processing_at: string | null;
  consent_marketing: boolean;
  consent_marketing_at: string | null;
  erasure_requested: boolean;
  erasure_requested_at: string | null;
  erased_at: string | null;
  info_sheet_delivered: boolean;
  info_sheet_delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BrokerCommissionStatementRow = {
  id: string;
  organization_id: string;
  created_by: string;
  document_id: string | null;
  insurer_name: string | null;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  total_amount: number | null;
  currency: string;
  status: "received" | "reconciled" | "disputed" | string;
  notes: string | null;
  reconciled_at: string | null;
  reconciled_by: string | null;
  source_storage_path: string | null;
  source_file_name: string | null;
  source_mime_type: string | null;
  source_size_bytes: number | null;
  created_at: string;
  updated_at: string;
};

export type BrokerCommissionRow = {
  id: string;
  organization_id: string;
  created_by: string;
  statement_id: string | null;
  contract_id: string | null;
  client_id: string | null;
  insurer_name: string | null;
  label: string | null;
  base_amount: number | null;
  rate: number | null;
  commission_amount: number | null;
  retrocession_rate: number | null;
  retrocession_amount: number | null;
  retrocession_beneficiary: string | null;
  introducer_id: string | null;
  period_label: string | null;
  currency: string;
  status: "expected" | "received" | "reconciled" | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BrokerClaimRow = {
  id: string;
  organization_id: string;
  client_id: string;
  contract_id: string | null;
  created_by: string;
  insurer_name: string | null;
  claim_type: string | null;
  reference: string | null;
  status:
    | "declared"
    | "in_progress"
    | "awaiting_docs"
    | "settled"
    | "closed"
    | "rejected"
    | string;
  occurrence_date: string | null;
  declaration_date: string | null;
  amount_estimate: number | null;
  amount_settled: number | null;
  currency: string;
  description: string | null;
  notes: string | null;
  settled_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BrokerEmailDigestRow = {
  id: string;
  organization_id: string;
  user_id: string;
  status: "generating" | "ready" | "failed" | string;
  narrative: string | null;
  window_start: string | null;
  window_end: string | null;
  relevant_count: number;
  excluded_count: number;
  generated_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type BrokerEmailItemRow = {
  id: string;
  organization_id: string;
  digest_id: string;
  user_id: string;
  graph_message_id: string;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  received_at: string | null;
  web_link: string | null;
  mailbox_address: string | null;
  category: string | null;
  summary: string | null;
  urgency: "normal" | "high" | string;
  relevance: "relevant" | "uncertain" | "excluded" | string;
  exclusion_reason: string | null;
  suggested_client_id: string | null;
  has_attachments: boolean;
  status: "pending" | "reviewed" | "dismissed" | string;
  created_at: string;
  updated_at: string;
};

export type BrokerEmailSuggestionRow = {
  id: string;
  organization_id: string;
  item_id: string;
  user_id: string;
  type:
    | "attach_document"
    | "draft_reply"
    | "create_client"
    | "declare_claim"
    | "flag_renewal"
    | string;
  status: "pending" | "accepted" | "rejected" | "done" | "failed" | string;
  confidence: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BrokerImportBatchRow = {
  id: string;
  organization_id: string;
  created_by: string;
  source_type: "folder" | "zip" | string;
  status:
    | "uploading"
    | "analyzing"
    | "review"
    | "committing"
    | "completed"
    | "failed"
    | string;
  file_count: number;
  analyzed_count: number;
  group_count: number;
  narrative: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type BrokerImportGroupRow = {
  id: string;
  organization_id: string;
  batch_id: string;
  match_client_id: string | null;
  client_type: "individual" | "company" | string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  insurance_type: string | null;
  needs: string | null;
  confidence: number | null;
  status: "pending" | "confirmed" | "skipped" | "committed" | string;
  created_client_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BrokerImportFileRow = {
  id: string;
  organization_id: string;
  batch_id: string;
  group_id: string | null;
  uploaded_by: string;
  original_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  staging_path: string;
  analysis_status: "pending" | "analyzed" | "skipped" | "failed" | string;
  extracted: Record<string, unknown>;
  decision: "include" | "exclude" | string;
  created_at: string;
  updated_at: string;
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
  quote_client_type: string | null;
  quote_price_ht: number | null;
  quote_tax_rate: number | null;
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

export type BillingConnectionRow = {
  id: string;
  organization_id: string;
  provider: "qonto" | "pennylane" | "odoo" | "invoice_ninja" | "manual" | string;
  auth_type: "api_key" | "oauth" | "manual" | string;
  status: "connected" | "disconnected" | "error" | string;
  encrypted_credentials: Record<string, unknown>;
  provider_account_id: string | null;
  metadata: Record<string, unknown>;
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingDocumentRow = {
  id: string;
  organization_id: string;
  deal_id: string | null;
  workflow_run_id: string | null;
  provider: "qonto" | "pennylane" | "odoo" | "invoice_ninja" | "manual" | string;
  document_type: "quote" | "invoice" | "credit_note" | string;
  provider_client_id: string | null;
  provider_quote_id: string | null;
  provider_quote_number: string | null;
  provider_quote_url: string | null;
  provider_status: string | null;
  amount_ht: number | null;
  amount_tva: number | null;
  amount_ttc: number | null;
  currency: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
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
          default_quote_client_type?: string;
          default_quote_tax_rate?: number;
          default_billing_provider?: string;
          meeting_bot_name?: string;
          workspace_type?: string;
          broker_offering?: string;
          plan?: string | null;
          plan_seats?: number | null;
          trial_ends_at?: string | null;
          current_period_end?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          storage_limit_bytes?: number;
          storage_used_bytes?: number;
          broker_settings?: Record<string, unknown>;
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
          default_quote_client_type?: string;
          default_quote_tax_rate?: number;
          default_billing_provider?: string;
          meeting_bot_name?: string;
          workspace_type?: string;
          broker_offering?: string;
          plan?: string | null;
          plan_seats?: number | null;
          trial_ends_at?: string | null;
          current_period_end?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          storage_limit_bytes?: number;
          storage_used_bytes?: number;
          broker_settings?: Record<string, unknown>;
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
          quote_client_type?: string | null;
          quote_price_ht?: number | null;
          quote_tax_rate?: number | null;
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

      billing_connections: TableDefinition<
        BillingConnectionRow,
        {
          id?: string;
          organization_id: string;
          provider: string;
          auth_type: string;
          status?: string;
          encrypted_credentials: Record<string, unknown>;
          provider_account_id?: string | null;
          metadata?: Record<string, unknown>;
          last_tested_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          organization_id?: string;
          provider?: string;
          auth_type?: string;
          status?: string;
          encrypted_credentials?: Record<string, unknown>;
          provider_account_id?: string | null;
          metadata?: Record<string, unknown>;
          last_tested_at?: string | null;
          last_error?: string | null;
          updated_at?: string;
        }
      >;

      billing_documents: TableDefinition<
        BillingDocumentRow,
        {
          id?: string;
          organization_id: string;
          deal_id?: string | null;
          workflow_run_id?: string | null;
          provider: string;
          document_type?: string;
          provider_client_id?: string | null;
          provider_quote_id?: string | null;
          provider_quote_number?: string | null;
          provider_quote_url?: string | null;
          provider_status?: string | null;
          amount_ht?: number | null;
          amount_tva?: number | null;
          amount_ttc?: number | null;
          currency?: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          organization_id?: string;
          deal_id?: string | null;
          workflow_run_id?: string | null;
          provider?: string;
          document_type?: string;
          provider_client_id?: string | null;
          provider_quote_id?: string | null;
          provider_quote_number?: string | null;
          provider_quote_url?: string | null;
          provider_status?: string | null;
          amount_ht?: number | null;
          amount_tva?: number | null;
          amount_ttc?: number | null;
          currency?: string;
          metadata?: Record<string, unknown>;
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

      broker_clients: TableDefinition<
        BrokerClientRow,
        {
          id?: string;
          organization_id: string;
          created_by: string;
          client_type?: string;
          first_name?: string | null;
          last_name?: string | null;
          company_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          postal_code?: string | null;
          city?: string | null;
          date_of_birth?: string | null;
          insurance_type?: string | null;
          status?: string;
          needs?: string | null;
          structured_needs?: Record<string, unknown>;
          notes?: string | null;
          introducer_id?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          client_type?: string;
          first_name?: string | null;
          last_name?: string | null;
          company_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          postal_code?: string | null;
          city?: string | null;
          date_of_birth?: string | null;
          insurance_type?: string | null;
          status?: string;
          needs?: string | null;
          structured_needs?: Record<string, unknown>;
          notes?: string | null;
          introducer_id?: string | null;
          archived_at?: string | null;
          updated_at?: string;
        }
      >;

      broker_introducers: TableDefinition<
        BrokerIntroducerRow,
        {
          id?: string;
          organization_id: string;
          created_by: string;
          name: string;
          retrocession_rate?: number | null;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          retrocession_rate?: number | null;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          archived_at?: string | null;
          updated_at?: string;
        }
      >;

      broker_activity: TableDefinition<
        BrokerActivityRow,
        {
          id?: string;
          organization_id: string;
          client_id: string;
          user_id?: string | null;
          type: string;
          description?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        }
      >;

      broker_documents: TableDefinition<
        BrokerDocumentRow,
        {
          id?: string;
          organization_id: string;
          client_id: string;
          uploaded_by: string;
          category?: string;
          title: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          size_bytes?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          category?: string;
          title?: string;
          status?: string;
          updated_at?: string;
        }
      >;

      broker_quotes: TableDefinition<
        BrokerQuoteRow,
        {
          id?: string;
          organization_id: string;
          client_id: string;
          document_id?: string | null;
          created_by: string;
          insurer_name?: string | null;
          product_name?: string | null;
          premium_monthly?: number | null;
          premium_annual?: number | null;
          currency?: string;
          coverage_summary?: string | null;
          deductible?: string | null;
          vigilance_points?: string | null;
          other_info?: string | null;
          notes?: string | null;
          extracted_data?: Record<string, unknown>;
          extraction_status?: string;
          validated_by?: string | null;
          validated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          document_id?: string | null;
          insurer_name?: string | null;
          product_name?: string | null;
          premium_monthly?: number | null;
          premium_annual?: number | null;
          currency?: string;
          coverage_summary?: string | null;
          deductible?: string | null;
          vigilance_points?: string | null;
          other_info?: string | null;
          notes?: string | null;
          extracted_data?: Record<string, unknown>;
          extraction_status?: string;
          validated_by?: string | null;
          validated_at?: string | null;
          updated_at?: string;
        }
      >;

      broker_contracts: TableDefinition<
        BrokerContractRow,
        {
          id?: string;
          organization_id: string;
          client_id: string;
          created_by: string;
          document_id?: string | null;
          insurer_name?: string | null;
          product_name?: string | null;
          insurance_type?: string | null;
          policy_number?: string | null;
          status?: string;
          effective_date?: string | null;
          renewal_date?: string | null;
          premium_amount?: number | null;
          premium_frequency?: string;
          currency?: string;
          tacit_renewal?: boolean;
          commission_rate?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          document_id?: string | null;
          insurer_name?: string | null;
          product_name?: string | null;
          insurance_type?: string | null;
          policy_number?: string | null;
          status?: string;
          effective_date?: string | null;
          renewal_date?: string | null;
          premium_amount?: number | null;
          premium_frequency?: string;
          currency?: string;
          tacit_renewal?: boolean;
          commission_rate?: number | null;
          notes?: string | null;
          updated_at?: string;
        }
      >;

      broker_agent_messages: TableDefinition<
        BrokerAgentMessageRow,
        {
          id?: string;
          organization_id: string;
          user_id: string;
          role: string;
          content: string;
          created_at?: string;
        }
      >;

      broker_commission_statements: TableDefinition<
        BrokerCommissionStatementRow,
        {
          id?: string;
          organization_id: string;
          created_by: string;
          document_id?: string | null;
          insurer_name?: string | null;
          period_label?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          total_amount?: number | null;
          currency?: string;
          status?: string;
          notes?: string | null;
          reconciled_at?: string | null;
          reconciled_by?: string | null;
          source_storage_path?: string | null;
          source_file_name?: string | null;
          source_mime_type?: string | null;
          source_size_bytes?: number | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          document_id?: string | null;
          insurer_name?: string | null;
          period_label?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          total_amount?: number | null;
          currency?: string;
          status?: string;
          notes?: string | null;
          reconciled_at?: string | null;
          reconciled_by?: string | null;
          source_storage_path?: string | null;
          source_file_name?: string | null;
          source_mime_type?: string | null;
          source_size_bytes?: number | null;
          updated_at?: string;
        }
      >;

      broker_commissions: TableDefinition<
        BrokerCommissionRow,
        {
          id?: string;
          organization_id: string;
          created_by: string;
          statement_id?: string | null;
          contract_id?: string | null;
          client_id?: string | null;
          insurer_name?: string | null;
          label?: string | null;
          base_amount?: number | null;
          rate?: number | null;
          commission_amount?: number | null;
          retrocession_rate?: number | null;
          retrocession_amount?: number | null;
          retrocession_beneficiary?: string | null;
          introducer_id?: string | null;
          period_label?: string | null;
          currency?: string;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          statement_id?: string | null;
          contract_id?: string | null;
          client_id?: string | null;
          insurer_name?: string | null;
          label?: string | null;
          base_amount?: number | null;
          rate?: number | null;
          commission_amount?: number | null;
          retrocession_rate?: number | null;
          retrocession_amount?: number | null;
          retrocession_beneficiary?: string | null;
          introducer_id?: string | null;
          period_label?: string | null;
          currency?: string;
          status?: string;
          notes?: string | null;
          updated_at?: string;
        }
      >;

      broker_email_digests: TableDefinition<
        BrokerEmailDigestRow,
        {
          id?: string;
          organization_id: string;
          user_id: string;
          status?: string;
          narrative?: string | null;
          window_start?: string | null;
          window_end?: string | null;
          relevant_count?: number;
          excluded_count?: number;
          generated_at?: string | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          status?: string;
          narrative?: string | null;
          window_start?: string | null;
          window_end?: string | null;
          relevant_count?: number;
          excluded_count?: number;
          generated_at?: string | null;
          error?: string | null;
          updated_at?: string;
        }
      >;

      broker_email_items: TableDefinition<
        BrokerEmailItemRow,
        {
          id?: string;
          organization_id: string;
          digest_id: string;
          user_id: string;
          graph_message_id: string;
          from_name?: string | null;
          from_email?: string | null;
          subject?: string | null;
          received_at?: string | null;
          web_link?: string | null;
          mailbox_address?: string | null;
          category?: string | null;
          summary?: string | null;
          urgency?: string;
          relevance?: string;
          exclusion_reason?: string | null;
          suggested_client_id?: string | null;
          has_attachments?: boolean;
          status?: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          category?: string | null;
          summary?: string | null;
          urgency?: string;
          relevance?: string;
          exclusion_reason?: string | null;
          suggested_client_id?: string | null;
          mailbox_address?: string | null;
          status?: string;
          updated_at?: string;
        }
      >;

      broker_email_suggestions: TableDefinition<
        BrokerEmailSuggestionRow,
        {
          id?: string;
          organization_id: string;
          item_id: string;
          user_id: string;
          type: string;
          status?: string;
          confidence?: string | null;
          payload?: Record<string, unknown>;
          result?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        },
        {
          status?: string;
          payload?: Record<string, unknown>;
          result?: Record<string, unknown>;
          updated_at?: string;
        }
      >;

      broker_import_batches: TableDefinition<
        BrokerImportBatchRow,
        {
          id?: string;
          organization_id: string;
          created_by: string;
          source_type?: string;
          status?: string;
          file_count?: number;
          analyzed_count?: number;
          group_count?: number;
          narrative?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        },
        {
          status?: string;
          file_count?: number;
          analyzed_count?: number;
          group_count?: number;
          narrative?: string | null;
          updated_at?: string;
          completed_at?: string | null;
        }
      >;

      broker_import_groups: TableDefinition<
        BrokerImportGroupRow,
        {
          id?: string;
          organization_id: string;
          batch_id: string;
          match_client_id?: string | null;
          client_type?: string;
          first_name?: string | null;
          last_name?: string | null;
          company_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          postal_code?: string | null;
          city?: string | null;
          insurance_type?: string | null;
          needs?: string | null;
          confidence?: number | null;
          status?: string;
          created_client_id?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          match_client_id?: string | null;
          client_type?: string;
          first_name?: string | null;
          last_name?: string | null;
          company_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          postal_code?: string | null;
          city?: string | null;
          insurance_type?: string | null;
          needs?: string | null;
          confidence?: number | null;
          status?: string;
          created_client_id?: string | null;
          updated_at?: string;
        }
      >;

      broker_import_files: TableDefinition<
        BrokerImportFileRow,
        {
          id?: string;
          organization_id: string;
          batch_id: string;
          group_id?: string | null;
          uploaded_by: string;
          original_path: string;
          file_name: string;
          mime_type: string;
          size_bytes?: number;
          staging_path: string;
          analysis_status?: string;
          extracted?: Record<string, unknown>;
          decision?: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          group_id?: string | null;
          staging_path?: string;
          analysis_status?: string;
          extracted?: Record<string, unknown>;
          decision?: string;
          updated_at?: string;
        }
      >;

      broker_claims: TableDefinition<
        BrokerClaimRow,
        {
          id?: string;
          organization_id: string;
          client_id: string;
          contract_id?: string | null;
          created_by: string;
          insurer_name?: string | null;
          claim_type?: string | null;
          reference?: string | null;
          status?: string;
          occurrence_date?: string | null;
          declaration_date?: string | null;
          amount_estimate?: number | null;
          amount_settled?: number | null;
          currency?: string;
          description?: string | null;
          notes?: string | null;
          settled_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          contract_id?: string | null;
          insurer_name?: string | null;
          claim_type?: string | null;
          reference?: string | null;
          status?: string;
          occurrence_date?: string | null;
          declaration_date?: string | null;
          amount_estimate?: number | null;
          amount_settled?: number | null;
          currency?: string;
          description?: string | null;
          notes?: string | null;
          settled_at?: string | null;
          closed_at?: string | null;
          updated_at?: string;
        }
      >;

      broker_compliance: TableDefinition<
        BrokerComplianceRow,
        {
          id?: string;
          organization_id: string;
          client_id: string;
          created_by: string;
          updated_by?: string | null;
          identity_verified?: boolean;
          identity_document_id?: string | null;
          identity_verified_at?: string | null;
          identity_verified_by?: string | null;
          risk_level?: string | null;
          is_pep?: boolean;
          pep_details?: string | null;
          funds_origin?: string | null;
          lcbft_notes?: string | null;
          consent_data_processing?: boolean;
          consent_data_processing_at?: string | null;
          consent_marketing?: boolean;
          consent_marketing_at?: string | null;
          erasure_requested?: boolean;
          erasure_requested_at?: string | null;
          erased_at?: string | null;
          info_sheet_delivered?: boolean;
          info_sheet_delivered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          updated_by?: string | null;
          identity_verified?: boolean;
          identity_document_id?: string | null;
          identity_verified_at?: string | null;
          identity_verified_by?: string | null;
          risk_level?: string | null;
          is_pep?: boolean;
          pep_details?: string | null;
          funds_origin?: string | null;
          lcbft_notes?: string | null;
          consent_data_processing?: boolean;
          consent_data_processing_at?: string | null;
          consent_marketing?: boolean;
          consent_marketing_at?: string | null;
          erasure_requested?: boolean;
          erasure_requested_at?: string | null;
          erased_at?: string | null;
          info_sheet_delivered?: boolean;
          info_sheet_delivered_at?: string | null;
          updated_at?: string;
        }
      >;

      broker_advice: TableDefinition<
        BrokerAdviceRow,
        {
          id?: string;
          organization_id: string;
          client_id: string;
          quote_id?: string | null;
          created_by: string;
          title?: string;
          content?: string;
          status?: string;
          docuseal_submission_id?: string | null;
          signature_status?: string | null;
          signature_url?: string | null;
          outlook_draft_id?: string | null;
          generated_at?: string | null;
          validated_by?: string | null;
          validated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          quote_id?: string | null;
          title?: string;
          content?: string;
          status?: string;
          docuseal_submission_id?: string | null;
          signature_status?: string | null;
          signature_url?: string | null;
          outlook_draft_id?: string | null;
          generated_at?: string | null;
          validated_by?: string | null;
          validated_at?: string | null;
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
