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

function extractString(obj: unknown, ...keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    if (key.includes(".")) {
      const [first, ...rest] = key.split(".");
      const nested = record[first];
      if (nested && typeof nested === "object") {
        const val = extractString(nested, rest.join("."));
        if (val) return val;
      }
    } else {
      const val = record[key];
      if (typeof val === "string" && val.length > 0) return val;
    }
  }
  return null;
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

  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  const eventType = (payload.event as string) ?? "";
  const data = (payload.data as Record<string, unknown>) ?? {};

  // Extract bot_id from multiple possible locations
  const botId = extractString(data, "bot_id", "bot.id");
  // Extract recording_id from multiple possible locations
  const recordingId = extractString(data, "recording_id", "recording.id", "id");

  // DEBUG: log full payload shape (no secrets, truncated)
  console.log(`[Recall webhook] event="${eventType}" bot_id="${botId}" recording_id="${recordingId}" payload=${JSON.stringify(payload).slice(0, 800)}`);

  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  // Find matching FalconDraft transcript by recall_bot_id
  let transcript: {
    id: string;
    organization_id: string;
    deal_id: string | null;
    status: string;
  } | null = null;

  if (botId) {
    const { data: row } = await adminSupabase
      .from("transcripts")
      .select("id, organization_id, deal_id, status")
      .eq("recall_bot_id", botId)
      .eq("source", "recall_ai")
      .maybeSingle();
    transcript = row;
  }

  console.log(`[Recall webhook] transcript_found=${!!transcript} transcript_id=${transcript?.id ?? "none"}`);

  if (!transcript) {
    return NextResponse.json({ ok: true });
  }

  // --- bot.status_change ---
  if (eventType === "bot.status_change") {
    const statusCode = extractString(data, "status.code");

    if (statusCode === "in_call_recording" && transcript.status === "waiting") {
      await adminSupabase
        .from("transcripts")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", transcript.id);
    }

    if (statusCode === "fatal") {
      const errorMsg =
        extractString(data, "status.message") ?? "Le bot Recall.ai a rencontré une erreur.";
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

  // --- recording.done ---
  if (eventType === "recording.done") {
    if (!recordingId) {
      console.error(`[Recall] recording.done — no recording_id extracted. data_keys=${Object.keys(data).join(",")}`);
      return NextResponse.json({ ok: true });
    }

    // Update status to processing before requesting transcription
    if (transcript.status === "waiting" || transcript.status === "processing") {
      await adminSupabase
        .from("transcripts")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", transcript.id);
    }

    const recallApiKey = process.env.RECALL_API_KEY;
    const recallBaseUrl = process.env.RECALL_API_BASE_URL || "https://api.recall.ai";

    if (!recallApiKey) {
      console.error("[Recall] RECALL_API_KEY not set, cannot call create_transcript");
      return NextResponse.json({ ok: true });
    }

    const url = `${recallBaseUrl}/api/v1/recording/${recordingId}/create_transcript/`;
    console.log(`[Recall] Calling create_transcript: POST ${url}`);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${recallApiKey}`,
      },
      body: JSON.stringify({
        provider: {
          recallai_async: {
            language_code: "auto",
          },
        },
        diarization: {
          use_separate_streams_when_available: true,
        },
      }),
    }).catch((err: unknown) => {
      console.error("[Recall] create_transcript fetch error:", err instanceof Error ? err.message : err);
      return null;
    });

    if (res?.ok) {
      console.log(`[Recall] create_transcript success — status=${res.status}`);
    } else {
      const body = res ? await res.text().catch(() => "") : "(no response)";
      console.error(`[Recall] create_transcript failed — status=${res?.status ?? "none"} body=${body}`);
    }
  }

  // --- transcript.done ---
  if (eventType === "transcript.done" || eventType === "bot.transcription_complete" || eventType === "transcript.ready") {
    const recallApiKey = process.env.RECALL_API_KEY;
    const recallBaseUrl = process.env.RECALL_API_BASE_URL || "https://api.recall.ai";

    // Extract the Recall transcript ID from the webhook payload
    const recallTranscriptId = extractString(data, "transcript.id");

    console.log(`[Recall] transcript.done — recall_transcript_id="${recallTranscriptId}"`);

    if (!recallTranscriptId || !recallApiKey) {
      console.error(`[Recall] Cannot fetch transcript — transcript_id=${recallTranscriptId}, api_key_set=${!!recallApiKey}`);
      return NextResponse.json({ ok: true });
    }

    // Fetch the transcript content from Recall.ai API
    const fetchUrl = `${recallBaseUrl}/api/v1/transcript/${recallTranscriptId}/`;
    console.log(`[Recall] Fetching transcript: GET ${fetchUrl}`);

    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: {
        Authorization: `Token ${recallApiKey}`,
        Accept: "application/json",
      },
    }).catch((err: unknown) => {
      console.error("[Recall] fetch transcript error:", err instanceof Error ? err.message : err);
      return null;
    });

    if (!res?.ok) {
      const body = res ? await res.text().catch(() => "") : "(no response)";
      console.error(`[Recall] fetch transcript failed — status=${res?.status ?? "none"} body=${body.slice(0, 500)}`);
      return NextResponse.json({ ok: true });
    }

    // Parse transcript segments and build full text
    const segments = (await res.json()) as Array<{
      participant?: { name?: string | null };
      words?: Array<{ text?: string }>;
    }>;

    console.log(`[Recall] transcript fetched — ${segments.length} segments`);

    // Build readable transcript: "Speaker: text\n\nSpeaker: text\n..."
    const transcriptText = segments
      .map((segment) => {
        const speaker = segment.participant?.name || "Participant";
        const text = (segment.words ?? []).map((w) => w.text ?? "").join(" ").trim();
        return text ? `${speaker}: ${text}` : null;
      })
      .filter(Boolean)
      .join("\n\n");

    console.log(`[Recall] transcript built — length=${transcriptText.length}`);

    if (transcriptText) {
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
    } else {
      console.error("[Recall] transcript text is empty after parsing segments");
    }
  }

  return NextResponse.json({ ok: true });
}
