export type TranscriptSource = "manual_paste" | "audio_upload" | "recall_ai";

export type TranscriptStatus = "ready" | "processing" | "waiting" | "error";

export type RecallBotStatus =
  | "joining_call"
  | "in_waiting_room"
  | "in_call_not_recording"
  | "recording_permission_allowed"
  | "recording_permission_denied"
  | "in_call_recording"
  | "call_ended"
  | "done"
  | "fatal"
  | null;

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
  recallBotStatus: RecallBotStatus;
  participants: unknown[] | null;
  startedAt: string | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};
