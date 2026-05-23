import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const rawKey = process.env.BILLING_CREDENTIALS_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error(
      "BILLING_CREDENTIALS_ENCRYPTION_KEY is required to encrypt billing credentials.",
    );
  }

  const trimmedKey = rawKey.trim();

  if (/^[a-f0-9]{64}$/i.test(trimmedKey)) {
    return Buffer.from(trimmedKey, "hex");
  }

  try {
    const decodedKey = Buffer.from(trimmedKey, "base64");
    if (decodedKey.length === 32) {
      return decodedKey;
    }
  } catch {
    // Not valid base64; fall through.
  }

  if (trimmedKey.length < 32) {
    throw new Error(
      "BILLING_CREDENTIALS_ENCRYPTION_KEY must be at least 32 characters.",
    );
  }

  return createHash("sha256").update(trimmedKey).digest();
}

export interface EncryptedPayload {
  v: number;
  iv: string;
  tag: string;
  data: string;
}

export function encryptBillingCredentials(
  credentials: Record<string, string>,
): EncryptedPayload {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(credentials);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    v: 1,
    iv: iv.toString("base64url"),
    tag: authTag.toString("base64url"),
    data: encrypted.toString("base64url"),
  };
}

export function decryptBillingCredentials(
  encryptedPayload: EncryptedPayload,
): Record<string, string> {
  if (!encryptedPayload || encryptedPayload.v !== 1) {
    throw new Error("Unsupported encrypted credential format.");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encryptedPayload.iv, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(encryptedPayload.tag, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPayload.data, "base64url")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}
