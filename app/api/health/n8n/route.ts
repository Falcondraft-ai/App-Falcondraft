import {
  createHealthResponse,
  getHealthTimestamp,
} from "../_shared";

export const dynamic = "force-dynamic";

const n8nHealthTimeoutMs = 5_000;

function n8nErrorResponse(timestamp: string) {
  return createHealthResponse(
    {
      status: "error",
      service: "n8n",
      timestamp,
      error: "n8n health check failed",
    },
    503,
  );
}

export async function GET() {
  const timestamp = getHealthTimestamp();
  const healthUrl = process.env.N8N_HEALTH_URL?.trim();

  if (!healthUrl) {
    console.warn("[health:n8n] n8n health check failed.");

    return n8nErrorResponse(timestamp);
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), n8nHealthTimeoutMs);

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
      signal: abortController.signal,
    });

    if (!response.ok) {
      console.warn("[health:n8n] n8n health check failed.");

      return n8nErrorResponse(timestamp);
    }

    return createHealthResponse({
      status: "ok",
      service: "n8n",
      timestamp,
    });
  } catch {
    console.warn("[health:n8n] n8n health check failed.");

    return n8nErrorResponse(timestamp);
  } finally {
    clearTimeout(timeout);
  }
}
