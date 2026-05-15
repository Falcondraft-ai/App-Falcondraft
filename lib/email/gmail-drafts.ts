import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/email/token-crypto";
import {
  googleOAuthProvider,
  refreshGoogleAccessToken,
} from "@/lib/email/google-oauth";

export type GmailDraftAttachment = {
  filename: string;
  contentType: "application/pdf";
  contentBase64: string;
};

type GmailDraftInput = {
  organizationId: string;
  userId: string;
  to: string;
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  attachments?: GmailDraftAttachment[];
};

type GmailDraftResponse = {
  id?: string;
  message?: {
    id?: string;
  };
  error?: {
    message?: string;
  };
};

function encodeHeader(value: string) {
  return value.replaceAll("\r", "").replaceAll("\n", " ");
}

function encodeMimeHeader(value: string) {
  const sanitizedValue = encodeHeader(value);

  if (/^[\x20-\x7E]*$/.test(sanitizedValue)) {
    return sanitizedValue;
  }

  const encodedWords: string[] = [];
  let chunk = "";

  for (const character of sanitizedValue) {
    const nextChunk = `${chunk}${character}`;

    if (Buffer.from(nextChunk, "utf8").toString("base64").length > 60) {
      encodedWords.push(
        `=?UTF-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`,
      );
      chunk = character;
      continue;
    }

    chunk = nextChunk;
  }

  if (chunk) {
    encodedWords.push(
      `=?UTF-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`,
    );
  }

  return encodedWords.join("\r\n ");
}

function sanitizeFilename(value: string) {
  return encodeHeader(value).replaceAll('"', "'");
}

function base64UrlEncode(value: string | Buffer) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");

  return buffer
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function foldBase64(value: string) {
  return value.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function buildTextOnlyRawMessage(input: GmailDraftInput) {
  const headers = [
    `To: ${encodeHeader(input.to)}`,
    input.cc?.length ? `Cc: ${input.cc.map(encodeHeader).join(", ")}` : null,
    input.bcc?.length ? `Bcc: ${input.bcc.map(encodeHeader).join(", ")}` : null,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ].filter(Boolean);

  return base64UrlEncode(`${headers.join("\r\n")}\r\n\r\n${input.body}`);
}

function buildMultipartRawMessage(input: GmailDraftInput) {
  const boundary = `falcondraft-${randomUUID()}`;
  const headers = [
    `To: ${encodeHeader(input.to)}`,
    input.cc?.length ? `Cc: ${input.cc.map(encodeHeader).join(", ")}` : null,
    input.bcc?.length ? `Bcc: ${input.bcc.map(encodeHeader).join(", ")}` : null,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean);

  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.body,
  ];

  for (const attachment of input.attachments ?? []) {
    const filename = sanitizeFilename(attachment.filename);
    const content = Buffer.from(attachment.contentBase64, "base64").toString(
      "base64",
    );

    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; name="${filename}"`,
      `Content-Disposition: attachment; filename="${filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      foldBase64(content),
    );
  }

  parts.push(`--${boundary}--`);

  return base64UrlEncode(
    `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`,
  );
}

function buildRawMessage(input: GmailDraftInput) {
  if (input.attachments?.length) {
    return buildMultipartRawMessage(input);
  }

  return buildTextOnlyRawMessage(input);
}

async function getUsableAccessToken(input: {
  connectionId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  expiresAt: string;
}) {
  const expiresAtMs = new Date(input.expiresAt).getTime();

  if (expiresAtMs > Date.now() + 60_000) {
    return decryptToken(input.encryptedAccessToken);
  }

  const refreshToken = decryptToken(input.encryptedRefreshToken);
  const refreshedToken = await refreshGoogleAccessToken(refreshToken);
  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  await adminSupabase
    .from("email_connections")
    .update({
      access_token: encryptToken(refreshedToken.accessToken),
      expires_at: refreshedToken.expiresAt,
      status: "connected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.connectionId);

  return refreshedToken.accessToken;
}

export async function createGmailDraftForConnectedUser(input: GmailDraftInput) {
  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  const { data: membership } = await adminSupabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    throw new Error("Utilisateur non autorisé pour ce workspace.");
  }

  const { data: connection } = await adminSupabase
    .from("email_connections")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .eq("provider", googleOAuthProvider)
    .eq("status", "connected")
    .maybeSingle();

  if (!connection) {
    throw new Error("Aucune connexion Gmail active pour cet utilisateur.");
  }

  const accessToken = await getUsableAccessToken({
    connectionId: connection.id,
    encryptedAccessToken: connection.access_token,
    encryptedRefreshToken: connection.refresh_token,
    expiresAt: connection.expires_at,
  });

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          raw: buildRawMessage(input),
        },
      }),
    },
  );
  const payload = (await response.json()) as GmailDraftResponse;

  if (!response.ok || !payload.id) {
    await adminSupabase
      .from("email_connections")
      .update({
        status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    throw new Error(
      payload.error?.message ?? "Création du brouillon Gmail impossible.",
    );
  }

  return {
    draftId: payload.id,
    messageId: payload.message?.id ?? null,
    email: connection.email,
  };
}
