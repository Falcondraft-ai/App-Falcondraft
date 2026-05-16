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
    const recallTranscriptId = extractString(data, "transcript.id");

    console.log(`[Recall webhook] event="${eventType}" bot_id="${botId}" recording_id="${recordingId}" transcript_id="${recallTranscriptId}"`);

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

    // --- bot.* status events ---
    if (eventType.startsWith("bot.")) {
      const recallBotStatus = eventType.replace("bot.", "");

      // Always save the latest recall bot status
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
        console.error(`[Recall] recording.done — no recording_id. data_keys=${Object.keys(data).join(",")}`);
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
    if (eventType === "transcript.done") {
      if (!recallTranscriptId) {
        console.error(`[Recall] transcript.done — no transcript_id. data_keys=${Object.keys(data).join(",")}`);
        return NextResponse.json({ ok: true });
      }

      const recallApiKey = process.env.RECALL_API_KEY;
      const recallBaseUrl = process.env.RECALL_API_BASE_URL || "https://api.recall.ai";

      if (!recallApiKey) {
        console.error("[Recall] RECALL_API_KEY not set");
        return NextResponse.json({ ok: true });
      }

      // Step 1: Get transcript metadata (contains download_url)
      const metaUrl = `${recallBaseUrl}/api/v1/transcript/${recallTranscriptId}/`;
      console.log(`[Recall] Fetching transcript metadata: GET ${metaUrl}`);

      const metaRes = await fetch(metaUrl, {
        method: "GET",
        headers: {
          Authorization: `Token ${recallApiKey}`,
          Accept: "application/json",
        },
      }).catch((err: unknown) => {
        console.error("[Recall] fetch transcript meta error:", err instanceof Error ? err.message : err);
        return null;
      });

      if (!metaRes?.ok) {
        const body = metaRes ? await metaRes.text().catch(() => "") : "(no response)";
        console.error(`[Recall] fetch transcript meta failed — status=${metaRes?.status ?? "none"} body=${body.slice(0, 500)}`);
        return NextResponse.json({ ok: true });
      }

      const metaBody = await metaRes.text();
      console.log(`[Recall] transcript meta response: ${metaBody.slice(0, 500)}`);

      let metaParsed: unknown;
      try {
        metaParsed = JSON.parse(metaBody);
      } catch {
        console.error("[Recall] Failed to parse transcript meta as JSON");
        return NextResponse.json({ ok: true });
      }

      // Extract download_url from the transcript object
      const downloadUrl =
        (metaParsed && typeof metaParsed === "object"
          ? ((metaParsed as Record<string, unknown>).download_url as string) ?? null
          : null);

      if (!downloadUrl) {
        // Maybe the response IS the segments directly (array)
        if (Array.isArray(metaParsed)) {
          console.log(`[Recall] meta response is already an array — using as segments`);
          // Fall through to segment parsing below with metaParsed as segments
        } else {
          console.error(`[Recall] No download_url found. Keys: ${metaParsed && typeof metaParsed === "object" ? Object.keys(metaParsed as Record<string, unknown>).join(",") : typeof metaParsed}`);
          return NextResponse.json({ ok: true });
        }
      }

      // Step 2: Fetch actual transcript segments from download_url
      let segments: Array<{
        participant?: { name?: string | null };
        words?: Array<{ text?: string }>;
      }>;

      if (Array.isArray(metaParsed)) {
        segments = metaParsed;
      } else {
        console.log(`[Recall] Fetching transcript data: GET ${downloadUrl}`);

        const dataRes = await fetch(downloadUrl!, {
          method: "GET",
          headers: { Accept: "application/json" },
        }).catch((err: unknown) => {
          console.error("[Recall] fetch transcript data error:", err instanceof Error ? err.message : err);
          return null;
        });

        if (!dataRes?.ok) {
          const body = dataRes ? await dataRes.text().catch(() => "") : "(no response)";
          console.error(`[Recall] fetch transcript data failed — status=${dataRes?.status ?? "none"} body=${body.slice(0, 500)}`);
          return NextResponse.json({ ok: true });
        }

        const dataBody = await dataRes.text();
        console.log(`[Recall] transcript data preview: ${dataBody.slice(0, 300)}`);

        let dataParsed: unknown;
        try {
          dataParsed = JSON.parse(dataBody);
        } catch {
          console.error("[Recall] Failed to parse transcript data as JSON");
          return NextResponse.json({ ok: true });
        }

        if (Array.isArray(dataParsed)) {
          segments = dataParsed;
        } else {
          console.error(`[Recall] transcript data is not an array. type=${typeof dataParsed}, keys=${dataParsed && typeof dataParsed === "object" ? Object.keys(dataParsed as Record<string, unknown>).join(",") : "n/a"}`);
          return NextResponse.json({ ok: true });
        }
      }

      console.log(`[Recall] transcript fetched — ${segments.length} segments`);

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

        console.log(`[Recall] transcript saved to DB — transcript_id=${transcript.id}`);
      } else {
        console.error("[Recall] transcript text is empty after parsing segments");
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[Recall webhook] Unhandled error:", err instanceof Error ? err.message : err, err instanceof Error ? err.stack : "");
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
