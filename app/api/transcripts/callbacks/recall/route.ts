import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanTranscriptText } from "@/lib/transcripts/clean-transcript";
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
    const sigBuf = Buffer.from(value, "base64");
    const expectedBuf = Buffer.from(expected, "base64");
    if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return true;
    }
  }

  return false;
}

function extractString(obj: unknown, ...paths: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;
  for (const path of paths) {
    if (path.includes(".")) {
      const parts = path.split(".");
      let current: unknown = record;
      for (const part of parts) {
        if (!current || typeof current !== "object") { current = null; break; }
        current = (current as Record<string, unknown>)[part];
      }
      if (typeof current === "string" && current.length > 0) return current;
    } else {
      const val = record[path];
      if (typeof val === "string" && val.length > 0) return val;
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
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

    const botId = extractString(data, "bot_id", "bot.id");
    const recordingId = extractString(data, "recording_id", "recording.id");

    const adminSupabase = getSupabaseAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
    }

    let transcript: {
      id: string;
      organization_id: string;
      deal_id: string | null;
      status: string;
      language: string | null;
    } | null = null;

    if (botId) {
      const { data: row } = await adminSupabase
        .from("transcripts")
        .select("id, organization_id, deal_id, status, language")
        .eq("recall_bot_id", botId)
        .eq("source", "recall_ai")
        .maybeSingle();
      transcript = row;
    }

    if (!transcript) {
      if (botId) {
        console.warn(`[Recall] No transcript found for bot_id=${botId}`);
      }
      return NextResponse.json({ ok: true });
    }

    // --- bot.* status events ---
    if (eventType.startsWith("bot.")) {
      const recallBotStatus = eventType.replace("bot.", "");

      await adminSupabase
        .from("transcripts")
        .update({
          recall_bot_status: recallBotStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transcript.id);

      if (recallBotStatus === "in_call_recording" && transcript.status === "waiting") {
        await adminSupabase
          .from("transcripts")
          .update({ status: "processing" })
          .eq("id", transcript.id);
      }

      if (recallBotStatus === "fatal") {
        const errorMsg =
          extractString(data, "data.message", "status.message") ?? "Le bot Recall.ai a rencontré une erreur.";
        await adminSupabase
          .from("transcripts")
          .update({ status: "error", error_message: errorMsg })
          .eq("id", transcript.id);
      }
    }

    // --- recording.done ---
    if (eventType === "recording.done") {
      if (!recordingId) {
        console.error("[Recall] recording.done — no recording_id in payload");
        return NextResponse.json({ ok: true });
      }

      if (transcript.status === "waiting" || transcript.status === "processing") {
        await adminSupabase
          .from("transcripts")
          .update({ status: "processing", updated_at: new Date().toISOString() })
          .eq("id", transcript.id);
      }

      const recallApiKey = process.env.RECALL_API_KEY;
      const recallBaseUrl = process.env.RECALL_API_BASE_URL || "https://api.recall.ai";

      if (!recallApiKey) {
        console.error("[Recall] RECALL_API_KEY not set");
        return NextResponse.json({ ok: true });
      }

      const languageCode = transcript.language || "auto";

      const res = await fetch(`${recallBaseUrl}/api/v1/recording/${recordingId}/create_transcript/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${recallApiKey}`,
        },
        body: JSON.stringify({
          provider: { recallai_async: { language_code: languageCode } },
          diarization: { use_separate_streams_when_available: true },
        }),
      }).catch((err: unknown) => {
        console.error("[Recall] create_transcript network error:", err instanceof Error ? err.message : err);
        return null;
      });

      if (!res?.ok) {
        const body = res ? await res.text().catch(() => "") : "(no response)";
        console.error(`[Recall] create_transcript failed — status=${res?.status ?? "none"} body=${body}`);
      }
    }

    // --- transcript.done ---
    if (eventType === "transcript.done") {
      if (!recordingId) {
        console.error("[Recall] transcript.done — no recording_id in payload");
        return NextResponse.json({ ok: true });
      }

      const recallApiKey = process.env.RECALL_API_KEY;
      const recallBaseUrl = process.env.RECALL_API_BASE_URL || "https://api.recall.ai";

      if (!recallApiKey) {
        console.error("[Recall] RECALL_API_KEY not set");
        return NextResponse.json({ ok: true });
      }

      // Get recording to find transcript download_url
      const recordingRes = await fetch(`${recallBaseUrl}/api/v1/recording/${recordingId}/`, {
        method: "GET",
        headers: {
          Authorization: `Token ${recallApiKey}`,
          Accept: "application/json",
        },
      }).catch((err: unknown) => {
        console.error("[Recall] fetch recording error:", err instanceof Error ? err.message : err);
        return null;
      });

      if (!recordingRes?.ok) {
        const body = recordingRes ? await recordingRes.text().catch(() => "") : "(no response)";
        console.error(`[Recall] fetch recording failed — status=${recordingRes?.status ?? "none"} body=${body.slice(0, 300)}`);
        return NextResponse.json({ ok: true });
      }

      const recording = (await recordingRes.json()) as Record<string, unknown>;
      const mediaShortcuts = recording.media_shortcuts as Record<string, unknown> | undefined;
      const transcriptShortcut = mediaShortcuts?.transcript as Record<string, unknown> | undefined;
      const transcriptData = transcriptShortcut?.data as Record<string, unknown> | undefined;
      const downloadUrl = transcriptData?.download_url as string | undefined;

      if (!downloadUrl) {
        console.error(`[Recall] No download_url in recording media_shortcuts`);
        return NextResponse.json({ ok: true });
      }

      // Fetch transcript segments
      const dataRes = await fetch(downloadUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
      }).catch((err: unknown) => {
        console.error("[Recall] fetch transcript data error:", err instanceof Error ? err.message : err);
        return null;
      });

      if (!dataRes?.ok) {
        const body = dataRes ? await dataRes.text().catch(() => "") : "(no response)";
        console.error(`[Recall] fetch transcript data failed — status=${dataRes?.status ?? "none"} body=${body.slice(0, 300)}`);
        return NextResponse.json({ ok: true });
      }

      const dataBody = await dataRes.text();

      let segments: Array<{
        participant?: { name?: string | null };
        words?: Array<{ text?: string }>;
      }>;

      try {
        const parsed = JSON.parse(dataBody);
        segments = Array.isArray(parsed) ? parsed : [];
      } catch {
        console.error("[Recall] Failed to parse transcript data as JSON");
        return NextResponse.json({ ok: true });
      }

      const rawTranscriptText = segments
        .map((segment) => {
          const speaker = segment.participant?.name || "Participant";
          const text = (segment.words ?? []).map((w) => w.text ?? "").join(" ").trim();
          return text ? `${speaker}: ${text}` : null;
        })
        .filter(Boolean)
        .join("\n\n");

      if (rawTranscriptText) {
        const transcriptText = await cleanTranscriptText(rawTranscriptText);

        await adminSupabase
          .from("transcripts")
          .update({
            status: "ready",
            transcript_text: transcriptText,
            recall_bot_status: "done",
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
        console.error("[Recall] Transcript text empty after parsing segments");
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[Recall webhook] Unhandled error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
