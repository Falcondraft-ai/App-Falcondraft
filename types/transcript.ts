export type TranscriptSource = "manual_paste" | "audio_upload" | "recall_ai";

export type TranscriptStatus = "ready" | "processing" | "waiting" | "error";

export type Transcript = {
  id: string;
  title: string;
  source: TranscriptSource;
  status: TranscriptStatus;
  language: string | null;
  transcriptText: string | null;
  dealId: string | null;
  dealName: string | null;
  createdByName: string | null;
  participants: unknown[] | null;
  startedAt: string | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};
