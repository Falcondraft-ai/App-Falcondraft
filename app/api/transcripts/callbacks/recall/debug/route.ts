import { NextResponse } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";

export async function POST(request: Request) {
  await requireCurrentUserContext();

  const body = await request.json() as { recordingId?: string };
  const recordingId = body.recordingId;

  if (!recordingId) {
    return NextResponse.json({ error: "recordingId required" }, { status: 400 });
  }

  const recallApiKey = process.env.RECALL_API_KEY;
  const recallBaseUrl = process.env.RECALL_API_BASE_URL || "https://api.recall.ai";

  if (!recallApiKey) {
    return NextResponse.json({ error: "RECALL_API_KEY not set" }, { status: 500 });
  }

  // Step 1: Get recording
  const recordingUrl = `${recallBaseUrl}/api/v1/recording/${recordingId}/`;
  const recordingRes = await fetch(recordingUrl, {
    headers: { Authorization: `Token ${recallApiKey}`, Accept: "application/json" },
  });

  if (!recordingRes.ok) {
    return NextResponse.json({
      step: "recording",
      status: recordingRes.status,
      body: (await recordingRes.text()).slice(0, 1000),
    });
  }

  const recording = await recordingRes.json() as Record<string, unknown>;
  const mediaShortcuts = recording.media_shortcuts as Record<string, unknown> | undefined;
  const transcriptShortcut = mediaShortcuts?.transcript as Record<string, unknown> | undefined;
  const transcriptData = transcriptShortcut?.data as Record<string, unknown> | undefined;
  const downloadUrl = transcriptData?.download_url as string | undefined;

  if (!downloadUrl) {
    return NextResponse.json({
      step: "no_download_url",
      recordingKeys: Object.keys(recording),
      mediaShortcutsKeys: mediaShortcuts ? Object.keys(mediaShortcuts) : null,
      transcriptShortcut: JSON.stringify(transcriptShortcut).slice(0, 500),
    });
  }

  // Step 2: Fetch transcript data
  const dataRes = await fetch(downloadUrl, {
    headers: { Accept: "application/json" },
  });

  if (!dataRes.ok) {
    return NextResponse.json({
      step: "download",
      status: dataRes.status,
      body: (await dataRes.text()).slice(0, 1000),
    });
  }

  const data = await dataRes.json();

  return NextResponse.json({
    step: "success",
    downloadUrl,
    dataType: Array.isArray(data) ? "array" : typeof data,
    segmentCount: Array.isArray(data) ? data.length : null,
    preview: JSON.stringify(data).slice(0, 500),
  });
}
