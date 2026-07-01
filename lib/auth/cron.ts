import "server-only";

import type { NextRequest } from "next/server";

/**
 * Authorizes an internal scheduled (cron) request. Accepts two shapes so the
 * endpoints can be driven natively by Vercel Cron — no external scheduler
 * required — while staying backward-compatible with the previous n8n trigger:
 *
 *  - Vercel Cron: `Authorization: Bearer <CRON_SECRET>` (added automatically by
 *    Vercel when the CRON_SECRET env var is set on the project).
 *  - Legacy / manual: `X-N8N-Secret` or `x-cron-secret` header = CRON_SECRET.
 *
 * Returns false when CRON_SECRET is not configured (caller should 503) or when
 * no valid credential is present (caller should 401).
 */
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;

  const header =
    request.headers.get("x-n8n-secret") ?? request.headers.get("x-cron-secret");
  return header === secret;
}
