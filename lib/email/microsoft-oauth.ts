import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const outlookDraftScope =
  "openid profile email offline_access https://graph.microsoft.com/Mail.ReadWrite";
export const outlookOAuthProvider = "outlook";

type MicrosoftOAuthState = {
  organizationId: string;
  userId: string;
  nonce: string;
  expiresAt: number;
};

type MicrosoftOAuthTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type MicrosoftProfileResponse = {
  mail?: string;
  userPrincipalName?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for Microsoft OAuth.`);
  }

  return value;
}

function getStateSigningSecret() {
  return getRequiredEnv("TOKEN_ENCRYPTION_KEY");
}

function signPayload(payload: string) {
  return createHmac("sha256", getStateSigningSecret())
    .update(payload)
    .digest("base64url");
}

export function createMicrosoftOAuthState(input: {
  organizationId: string;
  userId: string;
}) {
  const state: MicrosoftOAuthState = {
    organizationId: input.organizationId,
    userId: input.userId,
    nonce: randomBytes(16).toString("base64url"),
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString(
    "base64url",
  );
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

export function verifyMicrosoftOAuthState(stateValue: string | null) {
  if (!stateValue) {
    return null;
  }

  const [payload, signature] = stateValue.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  let parsedState: unknown;

  try {
    parsedState = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
  } catch {
    return null;
  }

  if (!parsedState || typeof parsedState !== "object") {
    return null;
  }

  const state = parsedState as Partial<MicrosoftOAuthState>;

  if (
    typeof state.organizationId !== "string" ||
    typeof state.userId !== "string" ||
    typeof state.nonce !== "string" ||
    typeof state.expiresAt !== "number" ||
    state.expiresAt < Date.now()
  ) {
    return null;
  }

  return {
    organizationId: state.organizationId,
    userId: state.userId,
  };
}

export function getMicrosoftAuthorizationUrl(input: { state: string }) {
  const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
  const url = new URL(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
  );

  url.searchParams.set("client_id", getRequiredEnv("MICROSOFT_CLIENT_ID"));
  url.searchParams.set(
    "redirect_uri",
    getRequiredEnv("MICROSOFT_REDIRECT_URI"),
  );
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", outlookDraftScope);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", input.state);

  return url;
}

export async function exchangeMicrosoftOAuthCode(code: string) {
  const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";

  const body = new URLSearchParams({
    client_id: getRequiredEnv("MICROSOFT_CLIENT_ID"),
    client_secret: getRequiredEnv("MICROSOFT_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: getRequiredEnv("MICROSOFT_REDIRECT_URI"),
    scope: outlookDraftScope,
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  const payload = (await response.json()) as MicrosoftOAuthTokenResponse;

  if (
    !response.ok ||
    !payload.access_token ||
    !payload.refresh_token ||
    !payload.expires_in
  ) {
    throw new Error(
      payload.error_description ??
        payload.error ??
        "Impossible de récupérer les jetons Microsoft.",
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000).toISOString(),
  };
}

export async function refreshOutlookAccessToken(refreshToken: string) {
  const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";

  const body = new URLSearchParams({
    client_id: getRequiredEnv("MICROSOFT_CLIENT_ID"),
    client_secret: getRequiredEnv("MICROSOFT_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: outlookDraftScope,
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  const payload = (await response.json()) as MicrosoftOAuthTokenResponse;

  if (!response.ok || !payload.access_token || !payload.expires_in) {
    throw new Error(
      payload.error_description ??
        payload.error ??
        "Impossible de rafraîchir la connexion Outlook.",
    );
  }

  return {
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000).toISOString(),
  };
}

export async function getMicrosoftProfileEmail(accessToken: string) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = (await response.json()) as MicrosoftProfileResponse;

  if (!response.ok) {
    throw new Error("Impossible de lire le profil Microsoft connecté.");
  }

  const email = payload.mail ?? payload.userPrincipalName;

  if (!email) {
    throw new Error("Impossible de lire l'email du profil Microsoft.");
  }

  return email;
}

export async function revokeMicrosoftToken(_token: string) {
  // Microsoft does not support token revocation via a standard endpoint.
  // Tokens expire naturally; deleting the connection from FalconDraft is sufficient.
}
