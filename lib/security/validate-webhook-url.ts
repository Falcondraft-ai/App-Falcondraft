import "server-only";

const PRIVATE_IP_PATTERNS: readonly RegExp[] = [
  /^127\./,                       // loopback
  /^0\.0\.0\.0$/,                 // null route
  /^10\./,                        // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./,  // Class B private
  /^192\.168\./,                  // Class C private
  /^169\.254\./,                  // link-local
];

const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isPrivateOrLocalIP(hostname: string): boolean {
  if (LOCALHOST_HOSTNAMES.has(hostname)) return true;
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

function getAllowedHosts(): Set<string> {
  const raw = (process.env.N8N_ALLOWED_WEBHOOK_HOSTS ?? "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Returns true if the URL is safe to fetch in the current environment.
 *
 * Production:
 *   - https only
 *   - Hostname must be listed in N8N_ALLOWED_WEBHOOK_HOSTS (comma-separated)
 *   - Rejects localhost, private IPs, link-local
 *   - If N8N_ALLOWED_WEBHOOK_HOSTS is missing, rejects
 *
 * Development:
 *   - Allows http://localhost and http://127.0.0.1
 *   - Allows any https:// URL
 *   - Still blocks private IP ranges (except localhost / 127.0.0.1)
 */
export function validateWebhookUrl(
  url: string,
): { valid: true } | { valid: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: "invalid_url" };
  }

  const isProduction = process.env.NODE_ENV === "production";
  const hostname = parsed.hostname.toLowerCase();
  const protocol = parsed.protocol;

  if (isProduction) {
    if (protocol !== "https:") {
      return { valid: false, reason: "https_required" };
    }

    const allowed = getAllowedHosts();
    if (allowed.size === 0) {
      return { valid: false, reason: "no_allowed_hosts_configured" };
    }

    if (!allowed.has(hostname)) {
      return { valid: false, reason: "hostname_not_allowed" };
    }

    return { valid: true };
  }

  // Development
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return { valid: true };
  }

  if (protocol !== "https:") {
    return { valid: false, reason: "https_required" };
  }

  if (isPrivateOrLocalIP(hostname)) {
    return { valid: false, reason: "private_ip_blocked" };
  }

  return { valid: true };
}
