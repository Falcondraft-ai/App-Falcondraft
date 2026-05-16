import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import crypto from "node:crypto";

function verifySvixSignature(
  rawBody: string,
  msgId: string | null,
  timestamp: string | null,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!msgId || !timestamp || !signatureHeader) return false;

  const secretBytes = Buffer.from(
    secret.startsWith("whsec_") ? secret.slice(6) : secret,
    "base64",
  );

  const signedPayload = `${msgId}.${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signedPayload)
    .digest("base64");

  const signatures = signatureHeader.split(" ");
  for (const sig of signatures) {
    const value = sig.startsWith("v1,") ? sig.slice(3) : null;
    if (!value) continue;
    if (
      value.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected))
    ) {
      return true;
    }
  }

  return false;
}

export async function POST(request: Request) {
  const secret = process.env.RECALL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Non configuré." }, { status: 500 });
  }

  const rawBody = await request.text();
  const msgId = request.headers.get("webhook-id");
  const timestamp = request.headers.get("webhook-timestamp");
  const signature = request.headers.get("webhook-signature");

  if (!verifySvixSignature(rawBody, msgId, timestamp, signature, secret)) {
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    event?: string;
    data?: {
      bot_id?: string;
      transcript?: { text?: string } | null;
      status?: { code?: string; message?: string };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };

  const botId = event.data?.bot_id;
  if (!botId) {
    return NextResponse.json({ ok: true });
  }

  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  const { data: transcript } = await adminSupabase
    .from("transcripts")
    .select("id, organization_id, deal_id, status")
    .eq("recall_bot_id", botId)
    .maybeSingle();

  if (!transcript) {
    return NextResponse.json({ ok: true });
  }

  const eventType = event.event ?? "";

  if (eventType === "bot.status_change") {
    const statusCode = event.data?.status?.code;

    if (statusCode === "in_call_recording" && transcript.status === "waiting") {
      await adminSupabase
        .from("transcripts")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", transcript.id);
    }

    if (statusCode === "fatal" || statusCode === "done") {
      if (statusCode === "fatal") {
        const errorMsg =
          event.data?.status?.message ?? "Le bot Recall.ai a rencontré une erreur.";
        await adminSupabase
          .from("transcripts")
          .update({
            status: "error",
            error_message: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", transcript.id);
      }
    }
  }

  if (eventType === "bot.transcription_complete" || eventType === "transcript.ready") {
    const transcriptText =
      event.data?.transcript?.text ??
      (typeof event.data?.transcript === "string" ? event.data.transcript : null);

    if (transcriptText && typeof transcriptText === "string") {
      await adminSupabase
        .from("transcripts")
        .update({
          status: "ready",
          transcript_text: transcriptText,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transcript.id);

      if (transcript.deal_id) {
        await adminSupabase
          .from("deals")
          .update({
            transcript: transcriptText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", transcript.deal_id)
          .eq("organization_id", transcript.organization_id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
