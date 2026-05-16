import { NextResponse } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";

export async function POST(request: Request) {
  // Only allow authenticated users (for manual debug)
  await requireCurrentUserContext();

  const body = await request.json() as { recallTranscriptId?: string };
  const recallTranscriptId = body.recallTranscriptId;

  if (!recallTranscriptId) {
    return NextResponse.json({ error: "recallTranscriptId required" }, { status: 400 });
  }

  const recallApiKey = process.env.RECALL_API_KEY;
  const recallBaseUrl = process.env.RECALL_API_BASE_URL || "https://api.recall.ai";

  if (!recallApiKey) {
    return NextResponse.json({ error: "RECALL_API_KEY not set" }, { status: 500 });
  }

  // Step 1: Get transcript metadata
  const metaUrl = `${recallBaseUrl}/api/v1/transcript/${recallTranscriptId}/`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Token ${recallApiKey}`, Accept: "application/json" },
  });

  const metaStatus = metaRes.status;
  const metaBody = await metaRes.text();

  if (!metaRes.ok) {
    return NextResponse.json({
      step: "meta",
      status: metaStatus,
      body: metaBody.slice(0, 1000),
    });
  }

  const metaParsed = JSON.parse(metaBody);
  const downloadUrl = metaParsed?.download_url ?? null;

  if (!downloadUrl) {
    return NextResponse.json({
      step: "meta_parsed",
      keys: Object.keys(metaParsed),
      preview: JSON.stringify(metaParsed).slice(0, 1000),
      downloadUrl: null,
    });
  }

  // Step 2: Fetch actual transcript data
  const dataRes = await fetch(downloadUrl, {
    headers: { Accept: "application/json" },
  });

  const dataStatus = dataRes.status;
  const dataBody = await dataRes.text();

  if (!dataRes.ok) {
    return NextResponse.json({
      step: "download",
      status: dataStatus,
      body: dataBody.slice(0, 1000),
    });
  }

  const dataParsed = JSON.parse(dataBody);

  return NextResponse.json({
    step: "success",
    metaKeys: Object.keys(metaParsed),
    downloadUrl,
    dataType: Array.isArray(dataParsed) ? "array" : typeof dataParsed,
    dataLength: Array.isArray(dataParsed) ? dataParsed.length : null,
    dataPreview: JSON.stringify(dataParsed).slice(0, 500),
  });
}
