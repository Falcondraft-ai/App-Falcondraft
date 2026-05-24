"server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  encryptBillingCredentials,
  decryptBillingCredentials,
  type EncryptedPayload,
} from "@/lib/billing/crypto";
import type {
  BillingProviderChoice,
  QontoCredentials,
  QontoOrganization,
} from "@/lib/billing/types";

const QONTO_API_BASE_URL_DEFAULT = "https://thirdparty.qonto.com";

function qontoAuthHeader(apiLogin: string, apiSecretKey: string): string {
  return `${apiLogin}:${apiSecretKey}`;
}

async function qontoTestRequest<T>(
  apiLogin: string,
  apiSecretKey: string,
  apiBaseUrl: string,
  path: string,
): Promise<T> {
  const url = `${apiBaseUrl.replace(/\/$/, "")}${path}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: qontoAuthHeader(apiLogin, apiSecretKey),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errorBody = await response.json();
      errorDetail = JSON.stringify(errorBody);
    } catch {
      errorDetail = await response.text().catch(() => "");
    }
    throw new Error(
      `Qonto API error (${response.status}): ${errorDetail || response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function testQontoConnection(
  apiLogin: string,
  apiSecretKey: string,
  apiBaseUrl: string | undefined,
): Promise<{ success: true; organization: QontoOrganization } | { success: false; error: string }> {
  const baseUrl = apiBaseUrl || QONTO_API_BASE_URL_DEFAULT;

  try {
    const result = await qontoTestRequest<{
      organization: QontoOrganization;
    }>(apiLogin, apiSecretKey, baseUrl, "/v2/organization");

    return { success: true, organization: result.organization };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue.";
    return { success: false, error: message };
  }
}

export async function storeQontoCredentials(
  adminSupabase: SupabaseClient<Database>,
  organizationId: string,
  apiLogin: string,
  apiSecretKey: string,
  apiBaseUrl: string | undefined,
): Promise<void> {
  const baseUrl = apiBaseUrl || QONTO_API_BASE_URL_DEFAULT;

  const encrypted = encryptBillingCredentials({
    api_login: apiLogin,
    api_secret_key: apiSecretKey,
    base_url: baseUrl,
  });

  const { error } = await adminSupabase
    .from("billing_connections")
    .upsert(
      {
        organization_id: organizationId,
        provider: "qonto",
        auth_type: "api_key",
        status: "connected",
        encrypted_credentials: encrypted as unknown as Record<string, unknown>,
        last_tested_at: new Date().toISOString(),
        last_error: null,
      },
      {
        onConflict: "organization_id,provider",
      },
    );

  if (error) {
    throw new Error(
      `Impossible d'enregistrer les identifiants Qonto: ${error.message}`,
    );
  }
}

export async function setBillingProvider(
  adminSupabase: SupabaseClient<Database>,
  organizationId: string,
  provider: BillingProviderChoice,
): Promise<void> {
  const { error } = await adminSupabase
    .from("organizations")
    .update({ default_billing_provider: provider })
    .eq("id", organizationId);

  if (error) {
    throw new Error(
      `Impossible de mettre à jour le provider de facturation: ${error.message}`,
    );
  }
}

export async function loadBillingProviderConfig(
  adminSupabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<{
  provider: BillingProviderChoice;
  qonto: {
    status: "non_configuré" | "connecté" | "erreur";
    masked_login: string;
    last_tested_at: string | null;
    last_error: string | null;
    provider_account_id: string | null;
  } | null;
}> {
  const [orgResult, connectionResult] = await Promise.all([
    adminSupabase
      .from("organizations")
      .select("default_billing_provider")
      .eq("id", organizationId)
      .maybeSingle(),
    adminSupabase
      .from("billing_connections")
      .select("status, provider_account_id, last_tested_at, last_error, encrypted_credentials")
      .eq("organization_id", organizationId)
      .eq("provider", "qonto")
      .maybeSingle(),
  ]);

  const provider =
    (orgResult.data?.default_billing_provider as BillingProviderChoice) ??
    "qonto";

  if (!connectionResult.data) {
    return { provider, qonto: null };
  }

  const conn = connectionResult.data;

  let maskedLogin = "****";
  try {
    const decrypted = decryptBillingCredentials(
      conn.encrypted_credentials as unknown as EncryptedPayload,
    );
    const login = decrypted.api_login ?? "";
    if (login.length > 0) {
      if (login.length <= 4) {
        maskedLogin = "*".repeat(login.length);
      } else {
        maskedLogin = "*".repeat(login.length - 4) + login.slice(-4);
      }
    }
  } catch {
    maskedLogin = "****";
  }

  let qontoStatus: "non_configuré" | "connecté" | "erreur";
  const dbStatus = conn.status;
  if (dbStatus === "connected") {
    qontoStatus = "connecté";
  } else if (dbStatus === "error" || dbStatus === "disconnected") {
    qontoStatus = "erreur";
  } else {
    qontoStatus = "non_configuré";
  }

  return {
    provider,
    qonto: {
      status: qontoStatus,
      masked_login: maskedLogin,
      last_tested_at: conn.last_tested_at ?? null,
      last_error: conn.last_error ?? null,
      provider_account_id: conn.provider_account_id ?? null,
    },
  };
}

export async function loadQontoCredentials(
  adminSupabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<QontoCredentials> {
  return loadQontoCredentialsFromDb(adminSupabase, organizationId).catch(
    () => loadQontoCredentialsFromEnv(),
  );
}

async function loadQontoCredentialsFromDb(
  adminSupabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<QontoCredentials> {
  const { data, error } = await adminSupabase
    .from("billing_connections")
    .select("encrypted_credentials")
    .eq("organization_id", organizationId)
    .eq("provider", "qonto")
    .eq("status", "connected")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Aucune connexion Qonto trouvée pour cette organisation.");
  }

  const decrypted = decryptBillingCredentials(
    data.encrypted_credentials as unknown as EncryptedPayload,
  );

  return {
    api_login: decrypted.api_login,
    api_secret_key: decrypted.api_secret_key,
    base_url: decrypted.base_url || QONTO_API_BASE_URL_DEFAULT,
  };
}

function loadQontoCredentialsFromEnv(): QontoCredentials {
  const apiLogin = process.env.QONTO_API_LOGIN;
  const apiSecretKey = process.env.QONTO_API_SECRET_KEY;
  const baseUrl =
    process.env.QONTO_API_BASE_URL || QONTO_API_BASE_URL_DEFAULT;

  if (!apiLogin || !apiSecretKey) {
    throw new Error(
      "QONTO_API_LOGIN et QONTO_API_SECRET_KEY sont requis (aucune billing_connection Qonto trouvée).",
    );
  }

  return { api_login: apiLogin, api_secret_key: apiSecretKey, base_url: baseUrl };
}
