import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const gmailDraftScope = "https://www.googleapis.com/auth/gmail.compose";
export const googleOAuthProvider = "gmail";

type GoogleOAuthState = {
  organizationId: string;
  userId: string;
  nonce: string;
  expiresAt: number;
};

type GoogleOAuthTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GmailProfileResponse = {
  emailAddress?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for Gmail OAuth.`);
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

export function createGoogleOAuthState(input: {
  organizationId: string;
  userId: string;
}) {
  const state: GoogleOAuthState = {
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

export function verifyGoogleOAuthState(stateValue: string | null) {
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

  const state = parsedState as Partial<GoogleOAuthState>;

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

export function getGoogleAuthorizationUrl(input: {
  state: string;
  loginHint?: string;
}) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  url.searchParams.set("client_id", getRequiredEnv("GOOGLE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", getRequiredEnv("GOOGLE_REDIRECT_URI"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", gmailDraftScope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("hl", "fr");
  url.searchParams.set("state", input.state);

  if (input.loginHint) {
    url.searchParams.set("login_hint", input.loginHint);
  }

  return url;
}

export async function exchangeGoogleOAuthCode(code: string) {
  const body = new URLSearchParams({
    client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: getRequiredEnv("GOOGLE_REDIRECT_URI"),
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = (await response.json()) as GoogleOAuthTokenResponse;

  if (
    !response.ok ||
    !payload.access_token ||
    !payload.refresh_token ||
    !payload.expires_in
  ) {
    throw new Error(
      payload.error_description ??
        payload.error ??
        "Impossible de récupérer les jetons Google.",
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000).toISOString(),
  };
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = (await response.json()) as GoogleOAuthTokenResponse;

  if (!response.ok || !payload.access_token || !payload.expires_in) {
    throw new Error(
      payload.error_description ??
        payload.error ??
        "Impossible de rafraîchir la connexion Gmail.",
    );
  }

  return {
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000).toISOString(),
  };
}

export async function getGmailProfileEmail(accessToken: string) {
  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  const payload = (await response.json()) as GmailProfileResponse;

  if (!response.ok || !payload.emailAddress) {
    throw new Error("Impossible de lire le profil Gmail connecté.");
  }

  return payload.emailAddress;
}

export async function revokeGoogleToken(token: string) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token }),
  }).catch((err) => {
    console.error("[google-oauth] token revocation failed:", err instanceof Error ? err.message : err);
  });
}
