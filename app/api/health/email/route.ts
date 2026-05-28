import {
  createHealthResponse,
  getHealthTimestamp,
} from "../_shared";

export const dynamic = "force-dynamic";

function emailErrorResponse(timestamp: string) {
  return createHealthResponse(
    {
      status: "error",
      service: "email",
      provider: "resend",
      timestamp,
      error: "Email health check failed",
    },
    503,
  );
}

export async function GET() {
  const timestamp = getHealthTimestamp();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const senderEmail =
    process.env.RESEND_FROM_EMAIL?.trim() || process.env.FROM_EMAIL?.trim();

  if (!resendApiKey || !senderEmail) {
    console.warn("[health:email] Email health check failed.");

    return emailErrorResponse(timestamp);
  }

  return createHealthResponse({
    status: "ok",
    service: "email",
    provider: "resend",
    timestamp,
  });
}
