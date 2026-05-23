import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  decryptBillingCredentials,
  type EncryptedPayload,
} from "@/lib/billing/crypto";
import type {
  CreateQuoteRequest,
  QuoteResponse,
  QontoCredentials,
  QontoClientResponse,
} from "@/lib/billing/types";
import { createQuoteRequestSchema } from "@/lib/billing/validation";

function loadQontoCredentials(
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
    .select("encrypted_credentials, provider_account_id")
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
    base_url: decrypted.base_url || "https://thirdparty.qonto.com",
  };
}

function loadQontoCredentialsFromEnv(): QontoCredentials {
  const apiLogin = process.env.QONTO_API_LOGIN;
  const apiSecretKey = process.env.QONTO_API_SECRET_KEY;
  const baseUrl =
    process.env.QONTO_API_BASE_URL || "https://thirdparty.qonto.com";

  console.info("[Qonto] Credentials loaded from env.", {
    QONTO_API_LOGIN_present: Boolean(apiLogin),
    QONTO_API_SECRET_KEY_present: Boolean(apiSecretKey),
    QONTO_API_BASE_URL: baseUrl,
  });

  if (!apiLogin || !apiSecretKey) {
    throw new Error(
      "QONTO_API_LOGIN et QONTO_API_SECRET_KEY sont requis (aucune billing_connection Qonto trouvée).",
    );
  }

  return { api_login: apiLogin, api_secret_key: apiSecretKey, base_url: baseUrl };
}

function qontoAuthHeader(credentials: QontoCredentials): string {
  return `${credentials.api_login}:${credentials.api_secret_key}`;
}

async function qontoRequest<T>(
  credentials: QontoCredentials,
  path: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `${credentials.base_url.replace(/\/$/, "")}${path}`;

  const headers: Record<string, string> = {
    Authorization: qontoAuthHeader(credentials),
    "Content-Type": "application/json",
  };

  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (body) {
    requestInit.body = JSON.stringify(body);
  }

  const response = await fetch(url, requestInit);

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

  const data = await response.json();
  return data as T;
}

function normalizeIdentifier(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function qontoClientDisplayName(c: QontoClientResponse): string {
  return (
    c.name ??
    ([c.first_name, c.last_name].filter(Boolean).join(" ") ||
      "")
  );
}

function splitIndividualName(
  fullName: string,
  first_name?: string,
  last_name?: string,
): { first_name: string; last_name: string } {
  if (first_name?.trim() && last_name?.trim()) {
    return { first_name: first_name.trim(), last_name: last_name.trim() };
  }

  const parts = fullName.trim().split(/\s+/);
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" ") || ".",
  };
}

async function findOrCreateQontoClient(
  credentials: QontoCredentials,
  client: CreateQuoteRequest["client"],
): Promise<{ qontoClient: QontoClientResponse; matchStrategy: string }> {
  const { tax_identification_number: tva, email, name, client_type } = client;
  const clientKind = client_type === "individual" ? "individual" : "company";

  if (client_type === "company") {
    // ── Company matching ──────────────────────────────────────
    // Require tax_identification_number (enforced by validation).
    // Search/reuse only on exact tax_identification_number match.
    // Never reuse based on name alone.
    if (!tva || tva.trim().length === 0) {
      throw new Error(
        "tax_identification_number est requis pour les clients de type company.",
      );
    }

    const searchParam = encodeURIComponent(tva.trim());

    try {
      const searchResult = await qontoRequest<{
        clients: QontoClientResponse[];
      }>(credentials, `/v2/clients?search=${searchParam}`, "GET");

      const normalizedTva = normalizeIdentifier(tva);
      const exactMatch = (searchResult.clients ?? []).find(
        (c) =>
          normalizeIdentifier(c.tax_identification_number) === normalizedTva,
      );

      if (exactMatch) {
        console.info("[Qonto] Client reused (company).", {
          match_strategy: "tax_identification_number_exact",
          action: "reused",
          client_type: "company",
          client_id: exactMatch.id,
          client_name: qontoClientDisplayName(exactMatch),
        });
        return { qontoClient: exactMatch, matchStrategy: "tax_identification_number_exact" };
      }
    } catch {
      // Search failed; create new below.
    }

    console.info("[Qonto] Creating new Qonto client (company).", {
      match_strategy: "created_new",
      action: "created",
      client_type: "company",
      client_name: name,
    });
  } else {
    // ── Individual matching ───────────────────────────────────
    // Do not use tax_identification_number.
    // Search/reuse only on exact email match.
    // If multiple email matches, also require exact name match.
    // Never reuse based on name alone.
    const searchQuery = email || name;
    const searchParam = encodeURIComponent(searchQuery);

    try {
      const searchResult = await qontoRequest<{
        clients: QontoClientResponse[];
      }>(credentials, `/v2/clients?search=${searchParam}`, "GET");

      const normalizedEmail = normalizeIdentifier(email);
      const emailMatches = (searchResult.clients ?? []).filter(
        (c) => normalizeIdentifier(c.email) === normalizedEmail,
      );

      if (emailMatches.length === 1) {
        console.info("[Qonto] Client reused (individual).", {
          match_strategy: "email_exact",
          action: "reused",
          client_type: "individual",
          client_id: emailMatches[0].id,
          client_name: qontoClientDisplayName(emailMatches[0]),
        });
        return { qontoClient: emailMatches[0], matchStrategy: "email_exact" };
      }

      if (emailMatches.length > 1) {
        // Multiple clients share the same email.
        // Require exact name match as additional disambiguation.
        const normalizedName = name.trim().toLowerCase();
        const nameMatch = emailMatches.find(
          (c) => qontoClientDisplayName(c).trim().toLowerCase() === normalizedName,
        );

        if (nameMatch) {
          console.info("[Qonto] Client reused (individual, email+name).", {
            match_strategy: "email_exact",
            action: "reused",
            client_type: "individual",
            client_id: nameMatch.id,
            client_name: qontoClientDisplayName(nameMatch),
          });
          return { qontoClient: nameMatch, matchStrategy: "email_exact" };
        }

        console.info(
          "[Qonto] Multiple email matches but no name match. Creating new client (individual).",
          {
            match_strategy: "created_new",
            action: "created",
            client_type: "individual",
            email_match_count: emailMatches.length,
          },
        );
        // Fall through to creation below.
      } else {
        // No email match found (search returned no results or no exact email match).
      }
    } catch {
      // Search failed; create new below.
    }

    console.info("[Qonto] Creating new Qonto client (individual).", {
      match_strategy: "created_new",
      action: "created",
      client_type: "individual",
    });
  }

  // ── Create new Qonto client ─────────────────────────────────
  const clientPayload: Record<string, unknown> = {
    type: clientKind,
    email,
    billing_address: {
      street_address: client.billing_address.street_address,
      city: client.billing_address.city,
      zip_code: client.billing_address.zip_code,
      country_code: client.billing_address.country_code,
    },
    currency: "EUR",
    locale: "fr",
  };

  if (client_type === "company") {
    // Company: send name + tax_identification_number
    clientPayload.name = name;

    if (tva && tva.trim().length > 0) {
      clientPayload.tax_identification_number = tva.trim();
    }
  } else {
    // Individual: split name into first_name + last_name
    // Do NOT send name (Qonto rejects it for individuals)
    // Do NOT send tax_identification_number
    const individualNames = splitIndividualName(
      name,
      client.first_name,
      client.last_name,
    );
    clientPayload.first_name = individualNames.first_name;
    clientPayload.last_name = individualNames.last_name;
  }

  const newClient = await qontoRequest<{ client: QontoClientResponse }>(
    credentials,
    "/v2/clients",
    "POST",
    { client: clientPayload },
  );

  return { qontoClient: newClient.client, matchStrategy: "created_new" };
}

function computeAmounts(
  items: CreateQuoteRequest["quote"]["items"],
): { amount_ht: number; amount_tva: number; amount_ttc: number } {
  let amountHt = 0;
  let amountTva = 0;

  for (const item of items) {
    const lineHt = item.unit_price_ht * item.quantity;
    const lineTva = lineHt * (item.tax_rate_percent / 100);
    amountHt += lineHt;
    amountTva += lineTva;
  }

  return {
    amount_ht: Math.round(amountHt * 100) / 100,
    amount_tva: Math.round(amountTva * 100) / 100,
    amount_ttc: Math.round((amountHt + amountTva) * 100) / 100,
  };
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

const attachmentKeyPatterns = [
  "attachment_id",
  "attachment",
  "pdf_attachment_id",
  "document",
] as const;

function findAttachmentKeys(keys: string[]): string[] {
  return keys.filter((key) =>
    attachmentKeyPatterns.some((pattern) =>
      key.toLowerCase().includes(pattern),
    ),
  );
}

function listKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const result: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    result.push(fullKey);

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = listKeys(value as Record<string, unknown>, fullKey);
      result.push(...nested);
    }

    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (first && typeof first === "object") {
        const nested = listKeys(first as Record<string, unknown>, `${fullKey}[0]`);
        result.push(...nested);
      }
    }
  }

  return result;
}

function logQontoQuoteKeys(
  rawResponse: Record<string, unknown>,
  quoteObj: Record<string, unknown>,
) {
  const topLevelKeys = Object.keys(rawResponse);
  const quoteKeys = Object.keys(quoteObj);
  const attachmentKeys = findAttachmentKeys(listKeys(quoteObj));

  console.info("[Qonto dev] Create quote response keys.", {
    top_level_keys: topLevelKeys,
    quote_keys: quoteKeys,
    attachment_related_keys: attachmentKeys,
  });
}

function logSanitizedQontoResponse(
  step: string,
  quoteId: string,
  status: number,
  keys: string[],
  hasAttachmentId: boolean,
) {
  console.info("[Qonto] API call completed.", {
    step,
    quote_id: quoteId,
    http_status: status,
    response_keys: keys,
    attachment_id_present: hasAttachmentId,
  });
}

function extractQontoAttachmentId(
  quoteObj: Record<string, unknown>,
): string | undefined {
  const extract = (value: unknown): string | undefined => {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;

      if (typeof obj.id === "string" && obj.id.length > 0) {
        return obj.id;
      }
    }

    return undefined;
  };

  // quote.attachment_id
  const directId = extract(quoteObj.attachment_id);
  if (directId) return directId;

  // quote.attachment.id
  const nestedId = extract(quoteObj.attachment);
  if (nestedId) return nestedId;

  // quote.attachments[0].id
  const attachments = quoteObj.attachments;
  if (Array.isArray(attachments) && attachments.length > 0) {
    const firstId = extract(attachments[0]);
    if (firstId) return firstId;
  }

  // quote.document.attachment_id
  const document = quoteObj.document;
  if (document && typeof document === "object" && !Array.isArray(document)) {
    const docId = extract((document as Record<string, unknown>).attachment_id);
    if (docId) return docId;
  }

  // quote.pdf_attachment_id
  const pdfId = extract(quoteObj.pdf_attachment_id);
  if (pdfId) return pdfId;

  return undefined;
}

// Qonto retrieve quote via GET /v2/quotes/{id}
//
// Documented at:
// https://docs.qonto.com/api-reference/business-api/expense-management/client-quotes-notes/quotes/retrieve-a-quote
//
// The Quote schema includes an optional `attachment_id` field.
// This field may not be present in the immediate create response, but may appear
// shortly after when retrieving the quote via this endpoint.
async function retrieveQontoQuote(
  credentials: QontoCredentials,
  quoteId: string,
): Promise<{ quote: Record<string, unknown>; status: number }> {
  const url = `${credentials.base_url.replace(/\/$/, "")}/v2/quotes/${quoteId}`;

  const headers: Record<string, string> = {
    Authorization: qontoAuthHeader(credentials),
    "Content-Type": "application/json",
  };

  const response = await fetch(url, { method: "GET", headers });

  if (!response.ok) {
    const status = response.status;
    let errorDetail = "";
    try {
      errorDetail = JSON.stringify(await response.json());
    } catch {
      errorDetail = await response.text().catch(() => "");
    }
    throw new Error(
      `Qonto retrieve quote error (${status}): ${errorDetail || response.statusText}`,
    );
  }

  const raw = (await response.json()) as { quote: Record<string, unknown> };
  return { quote: raw.quote, status: response.status };
}

// Resolve the Qonto attachment ID for a quote after creation.
//
// Strategy (documented endpoints only):
//   1. Try to extract attachment_id from the create response (immediate).
//   2. Retrieve the quote via GET /v2/quotes/{id} — the Quote schema documents
//      an optional `attachment_id` field that may appear after initial processing.
//   3. Retry the retrieve endpoint up to maxRetries times with delay between attempts,
//      in case Qonto generates the PDF asynchronously.
//   4. If not found after all attempts, return { id: undefined, resolution: "not_found" }.
//
// No undocumented endpoints are used. No guesswork.
export async function resolveQontoQuoteAttachmentId(
  credentials: QontoCredentials,
  createResponseQuote: Record<string, unknown>,
  maxRetries = 2,
  retryDelayMs = 800,
): Promise<{
  id: string | undefined;
  resolution: "immediate" | "retrieved" | "not_found";
}> {
  const immediateId = extractQontoAttachmentId(createResponseQuote);
  if (immediateId) {
    return { id: immediateId, resolution: "immediate" };
  }

  const quoteId = String(createResponseQuote.id ?? "");
  if (!quoteId) {
    console.warn("[Qonto] Cannot resolve attachment_id: quote has no id.");
    return { id: undefined, resolution: "not_found" };
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }

      const { quote, status } = await retrieveQontoQuote(credentials, quoteId);
      const retrievedKeys = Object.keys(quote);
      const retrievedAttachmentId = extractQontoAttachmentId(quote);

      if (process.env.NODE_ENV === "development") {
        logSanitizedQontoResponse(
          "retrieve_quote",
          quoteId,
          status,
          retrievedKeys,
          !!retrievedAttachmentId,
        );
      }

      if (retrievedAttachmentId) {
        console.info("[Qonto] Attachment ID resolved via retrieve quote.", {
          quote_id: quoteId,
          attempt,
          resolution: "retrieved",
        });
        return { id: retrievedAttachmentId, resolution: "retrieved" };
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.warn("[Qonto] Retrieve quote attempt failed.", {
        quote_id: quoteId,
        attempt,
        reason: message,
      });
    }
  }

  console.info(
    "[Qonto] Attachment ID not found after retrieval attempts. Falling back to provider_quote_url.",
    { quote_id: quoteId, attempts: maxRetries },
  );

  return { id: undefined, resolution: "not_found" };
}

export async function createQontoQuote(
  adminSupabase: SupabaseClient<Database>,
  rawInput: unknown,
): Promise<QuoteResponse> {
  const parsed = createQuoteRequestSchema.parse(rawInput);

  if (parsed.provider !== "qonto") {
    throw new Error(`Provider "${parsed.provider}" non supporté.`);
  }

  const credentials = await loadQontoCredentials(
    adminSupabase,
    parsed.organization_id,
  );

  const { qontoClient, matchStrategy } = await findOrCreateQontoClient(
    credentials,
    parsed.client,
  );

  const amounts = computeAmounts(parsed.quote.items);
  const issueDate = todayISO();
  const expiryDate = addDays(issueDate, parsed.quote.validity_days ?? 30);

  const rawResponse = await qontoRequest<{ quote: Record<string, unknown> }>(
    credentials,
    "/v2/quotes",
    "POST",
    {
      client_id: qontoClient.id,
      currency: parsed.quote.currency ?? "EUR",
      issue_date: issueDate,
      expiry_date: expiryDate,
      terms_and_conditions: parsed.quote.terms_and_conditions ?? "",
      items: parsed.quote.items.map((item) => ({
        title: item.title,
        description: item.description ?? "",
        quantity: String(item.quantity),
        unit_price: {
          value: item.unit_price_ht.toFixed(2),
          currency: parsed.quote.currency ?? "EUR",
        },
        vat_rate: parseFloat(
          (item.tax_rate_percent / 100).toFixed(4),
        ).toString(),
        unit: item.unit ?? "piece",
      })),
    },
  );

  const quoteObj = rawResponse.quote as Record<string, unknown>;

  if (process.env.NODE_ENV === "development") {
    logQontoQuoteKeys(rawResponse, quoteObj);
  }

  const attachmentResult = await resolveQontoQuoteAttachmentId(
    credentials,
    quoteObj,
  );
  const qontoAttachmentId = attachmentResult.id;

  const qontoQuote = {
    id: String(quoteObj.id ?? ""),
    number: String(quoteObj.number ?? ""),
    status: String(quoteObj.status ?? ""),
    quote_url: String(quoteObj.quote_url ?? ""),
    currency: String(quoteObj.currency ?? "EUR"),
    client_id: String(quoteObj.client_id ?? ""),
  };

  const { data: inserted, error: insertError } = await adminSupabase
    .from("billing_documents")
    .insert({
      organization_id: parsed.organization_id,
      deal_id: parsed.deal_id ?? null,
      workflow_run_id: parsed.workflow_run_id ?? null,
      provider: "qonto",
      document_type: "quote",
      provider_client_id: qontoClient.id,
      provider_quote_id: qontoQuote.id,
      provider_quote_number: qontoQuote.number,
      provider_quote_url: qontoQuote.quote_url,
      provider_status: qontoQuote.status,
      amount_ht: amounts.amount_ht,
      amount_tva: amounts.amount_tva,
      amount_ttc: amounts.amount_ttc,
      currency: qontoQuote.currency,
      metadata: {
        qonto_client_name: qontoClient.name ?? ([qontoClient.first_name, qontoClient.last_name].filter(Boolean).join(" ") || qontoClient.id),
        qonto_client_email: qontoClient.email,
        qonto_client_match_strategy: matchStrategy,
        validity_days: parsed.quote.validity_days ?? 30,
        issue_date: issueDate,
        expiry_date: expiryDate,
        qonto_attachment_resolution: attachmentResult.resolution,
        ...(qontoAttachmentId
          ? { qonto_attachment_id: qontoAttachmentId }
          : {}),
        ...(process.env.NODE_ENV === "development"
          ? { qonto_quote_response_keys: listKeys(quoteObj) }
          : {}),
      },
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `Échec de l'enregistrement du document de facturation: ${insertError?.message ?? "aucune ligne retournée"}`,
    );
  }

  return {
    success: true,
    provider: "qonto",
    billing_document_id: inserted.id,
    quote_id: qontoQuote.id,
    quote_number: qontoQuote.number,
    quote_url: qontoQuote.quote_url,
    status: qontoQuote.status,
    amount_ht: amounts.amount_ht,
    amount_tva: amounts.amount_tva,
    amount_ttc: amounts.amount_ttc,
    currency: qontoQuote.currency,
  };
}

// Qonto attachment download via GET /v2/attachments/{id}
//
// The previously assumed /v2/quotes/:id/download endpoint does not exist (404).
// Qonto's documented attachment flow:
//   1. GET /v2/attachments/{attachment_id} → returns { attachment: { url, file_name, ... } }
//   2. The url is a temporary pre-signed download URL (valid 30 minutes)
//   3. Fetch the binary from that url
//
// If a quote has an attachment_id (returned by Qonto in the create quote response),
// this function retrieves and returns the PDF binary. If no attachment_id is available,
// the caller falls back to redirecting to provider_quote_url.
export async function fetchQontoQuotePdf(
  adminSupabase: SupabaseClient<Database>,
  organizationId: string,
  attachmentId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const credentials = await loadQontoCredentials(adminSupabase, organizationId);

  const attachmentResponse = await qontoRequest<{
    attachment: { id: string; url: string; file_name: string };
  }>(credentials, `/v2/attachments/${attachmentId}`, "GET");

  if (!attachmentResponse.attachment?.url) {
    throw new Error(
      "Aucune URL de téléchargement d'attachment disponible dans la réponse Qonto.",
    );
  }

  const downloadUrl = attachmentResponse.attachment.url.replace(
    /\\u0026/g,
    "&",
  );

  const fileResponse = await fetch(downloadUrl);

  if (!fileResponse.ok) {
    throw new Error(
      `Impossible de télécharger le fichier Qonto (${fileResponse.status}).`,
    );
  }

  const arrayBuffer = await fileResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    buffer,
    filename: attachmentResponse.attachment.file_name || `devis-${attachmentId}.pdf`,
  };
}
