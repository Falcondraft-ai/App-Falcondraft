import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

const algorithm = "aes-256-gcm";

function getTokenEncryptionKey() {
  const rawKey = process.env.TOKEN_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is required to encrypt email tokens.",
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
    // Key is not valid base64; falling through to SHA-256 derivation.
  }

  if (trimmedKey.length < 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must contain at least 32 characters.",
    );
  }

  return createHash("sha256").update(trimmedKey).digest();
}

export function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getTokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptToken(encryptedToken: string) {
  const [version, iv, authTag, encrypted] = encryptedToken.split(".");

  if (version !== "v1" || !iv || !authTag || !encrypted) {
    throw new Error("Unsupported encrypted token format.");
  }

  const decipher = createDecipheriv(
    algorithm,
    getTokenEncryptionKey(),
    Buffer.from(iv, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
