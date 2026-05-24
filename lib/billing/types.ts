import type { EncryptedPayload } from "./crypto";

export type BillingProvider = "qonto" | "pennylane" | "odoo" | "invoice_ninja" | "manual";

export type BillingConnectionStatus = "connected" | "disconnected" | "error";

export type BillingAuthType = "api_key" | "oauth" | "manual";

export type BillingDocumentType = "quote" | "invoice" | "credit_note";

export interface QontoCredentials {
  api_login: string;
  api_secret_key: string;
  base_url: string;
}

export interface BillingConnection {
  id: string;
  organization_id: string;
  provider: BillingProvider;
  auth_type: BillingAuthType;
  status: BillingConnectionStatus;
  encrypted_credentials: EncryptedPayload;
  provider_account_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BillingAddress {
  street_address: string;
  city: string;
  zip_code: string;
  country_code: string;
}

export interface QuoteClient {
  client_type?: "company" | "individual";
  name: string;
  email: string;
  tax_identification_number?: string;
  first_name?: string;
  last_name?: string;
  billing_address: BillingAddress;
}

export interface QuoteItem {
  title: string;
  description?: string;
  quantity: number;
  unit_price_ht: number;
  tax_rate_percent: number;
  unit?: string;
}

export interface QuotePayload {
  currency?: string;
  validity_days?: number;
  terms_and_conditions?: string;
  items: QuoteItem[];
}

export interface CreateQuoteRequest {
  workflow_run_id?: string;
  organization_id: string;
  deal_id?: string;
  provider?: BillingProvider;
  client: QuoteClient;
  quote: QuotePayload;
}

export interface QuoteResponse {
  success: boolean;
  provider: BillingProvider;
  billing_document_id: string;
  quote_id: string;
  quote_number: string;
  quote_url: string;
  status: string;
  amount_ht: number;
  amount_tva: number;
  amount_ttc: number;
  currency: string;
}

export interface QontoClientResponse {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  kind: string;
  currency: string;
  tax_identification_number: string | null;
}

export interface QontoQuoteResponse {
  id: string;
  number: string;
  status: string;
  quote_url: string;
  attachment_id?: string;
  client_id: string;
  amount_ht: string;
  amount_tva: string;
  amount_ttc: string;
  currency: string;
}

export type BillingProviderChoice = "none" | "qonto";

export interface QontoConfigInput {
  api_login: string;
  api_secret_key: string;
  api_base_url?: string;
}

export interface BillingProviderConfigRequest {
  provider: BillingProviderChoice;
  qonto?: QontoConfigInput;
}

export interface BillingProviderConfigResponse {
  provider: BillingProviderChoice;
  qonto?: {
    status: "non_configuré" | "connecté" | "erreur";
    masked_login: string;
    last_tested_at: string | null;
    last_error: string | null;
    provider_account_id: string | null;
  };
}

export interface QontoOrganization {
  id: string;
  name: string;
  slug: string;
  bank_accounts: Array<{
    slug: string;
    iban: string;
    bic: string;
  }>;
}
