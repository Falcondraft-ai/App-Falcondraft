import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import {
  archiveSubmission,
  downloadSignedDocument,
  type DocusealSubmissionState,
} from "@/lib/broker/docuseal";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import {
  adjustOrganizationStorage,
  advanceClientStatus,
  logBrokerActivity,
} from "@/lib/broker/server";
import { computeStorageUsage } from "@/lib/broker/storage";
import type { BrokerAdviceRow, BrokerClientRow, Database } from "@/types/database";

type Admin = SupabaseClient<Database>;
type AdviceUpdate = Database["public"]["Tables"]["broker_advice"]["Update"];

/** Lifecycle of a signature request, as surfaced to the broker. */
export const SIGNATURE_STATUSES = [
  "sent",
  "viewed",
  "completed",
  "declined",
  "expired",
  "cancelled",
  /** The document changed after the request went out — see supersedeAdviceSignature. */
  "superseded",
] as const;

export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number];

/** Statuses for which the signer can still act — the reminder cron's scope. */
export const PENDING_SIGNATURE_STATUSES: SignatureStatus[] = ["sent", "viewed"];

/**
 * Called when the devoir de conseil's substance changes, to keep the signature
 * honest about which version it covers. The provider holds its own copy of the
 * PDF, so an outstanding link would let the client sign a document that no
 * longer matches what we hold — hence the cancellation rather than a warning.
 *
 * Two cases, both non-destructive of the audit trail:
 *  - request still pending → the submission is archived (the link dies) and the
 *    document drops back to "validated", ready for a fresh request;
 *  - already signed → the signature and its archived PDFs are kept as-is, but
 *    flagged `superseded` so the interface can offer to re-sign the new version.
 *
 * Best-effort: never throws, so an edit is never blocked by this.
 */
export async function supersedeAdviceSignature(params: {
  adminSupabase: Admin;
  organizationId: string;
  advice: Pick<
    BrokerAdviceRow,
    "id" | "client_id" | "status" | "signature_status" | "docuseal_submission_id"
  >;
  userId: string | null;
}): Promise<{ cancelledPending: boolean; flaggedSigned: boolean }> {
  const { adminSupabase, organizationId, advice, userId } = params;
  const idle = { cancelledPending: false, flaggedSigned: false };

  const status = advice.signature_status;
  if (!status || status === "superseded") return idle;

  const now = new Date().toISOString();

  try {
    if (status === "completed") {
      await adminSupabase
        .from("broker_advice")
        .update({ signature_status: "superseded", updated_at: now })
        .eq("organization_id", organizationId)
        .eq("id", advice.id);
      await logBrokerActivity(adminSupabase, {
        organizationId,
        clientId: advice.client_id,
        userId,
        type: "advice_signature_superseded",
        description:
          "Devoir de conseil modifié après signature — la version signée ne correspond plus au document actuel.",
        metadata: { advice_id: advice.id },
      });
      return { cancelledPending: false, flaggedSigned: true };
    }

    // Pending (sent / viewed): kill the link so nobody signs a stale version.
    if (!PENDING_SIGNATURE_STATUSES.includes(status as SignatureStatus)) {
      return idle;
    }
    if (advice.docuseal_submission_id) {
      await archiveSubmission(advice.docuseal_submission_id);
    }
    await adminSupabase
      .from("broker_advice")
      .update({
        signature_status: "superseded",
        signature_url: null,
        docuseal_submission_id: null,
        docuseal_submitter_id: null,
        signature_expires_at: null,
        signature_last_reminder_at: null,
        signature_reminder_count: 0,
        status: advice.status === "sent_for_signature" ? "validated" : advice.status,
        updated_at: now,
      })
      .eq("organization_id", organizationId)
      .eq("id", advice.id);
    await logBrokerActivity(adminSupabase, {
      organizationId,
      clientId: advice.client_id,
      userId,
      type: "advice_signature_superseded",
      description:
        "Devoir de conseil modifié : la demande de signature en cours a été annulée, l’ancien lien ne fonctionne plus.",
      metadata: { advice_id: advice.id },
    });
    return { cancelledPending: true, flaggedSigned: false };
  } catch (error) {
    console.error("[broker] superseding signature failed:", error);
    return idle;
  }
}

export type SignatureSyncResult = {
  /** True when the row was actually modified. */
  changed: boolean;
  signed: boolean;
  status: SignatureStatus | null;
};

const NO_CHANGE: SignatureSyncResult = {
  changed: false,
  signed: false,
  status: null,
};

/** Days a signature link stays valid, overridable per deployment. */
export function signatureExpiryDays(): number {
  const raw = Number(process.env.DOCUSEAL_SIGNATURE_EXPIRY_DAYS ?? "30");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30;
}

/** Minimum delay between two reminders — also the manual button's throttle. */
export const REMINDER_MIN_INTERVAL_MS = 24 * 3_600_000;

/** Days of silence before the cron sends the first automatic reminder. */
export const REMINDER_FIRST_DELAY_MS = 3 * 86_400_000;

/** Automatic reminders stop here; past that it's a phone call, not an email. */
export const REMINDER_MAX_COUNT = 3;

/**
 * Reminder email sent by the provider on the broker's behalf. Deliberately
 * short and neutral — the substance was in the broker's own first email.
 */
export function buildReminderMessage(cabinetName: string | null): {
  subject: string;
  body: string;
} {
  const from = cabinetName?.trim() || "votre courtier";
  return {
    subject: "Rappel : votre devoir de conseil est en attente de signature",
    body:
      `Bonjour,\n\n` +
      `Votre devoir de conseil est toujours en attente de votre signature. ` +
      `Vous pouvez le signer en ligne, en quelques instants :\n\n` +
      `{{submitter.link}}\n\n` +
      `Si vous avez la moindre question avant de signer, répondez simplement à cet email.\n\n` +
      `Bien à vous,\n${from}`,
  };
}

/**
 * Applies a provider submission state to a devoir de conseil.
 *
 * Single entry point shared by the webhook and the manual/polled refresh, so
 * both paths archive the signed document and advance the dossier identically.
 * Idempotent: replaying a `completed` event is a no-op once archived. Never
 * throws — a signature must never be lost because a side effect failed.
 */
export async function applyAdviceSignatureState(params: {
  adminSupabase: Admin;
  organizationId: string;
  advice: Pick<
    BrokerAdviceRow,
    | "id"
    | "client_id"
    | "created_by"
    | "status"
    | "signature_status"
    | "signature_viewed_at"
    | "signed_document_id"
    | "docuseal_submission_id"
  >;
  state: DocusealSubmissionState;
  /** Broker who triggered the refresh; null when the provider called us. */
  userId: string | null;
}): Promise<SignatureSyncResult> {
  const { adminSupabase, organizationId, advice, state, userId } = params;
  const now = new Date().toISOString();

  if (state.completed) {
    return completeAdviceSignature({
      adminSupabase,
      organizationId,
      advice,
      state,
      userId,
    });
  }

  if (state.declined && advice.signature_status !== "declined") {
    const update: AdviceUpdate = {
      signature_status: "declined",
      signature_declined_at: state.declinedAt ?? now,
      signature_decline_reason: state.declineReason,
      updated_at: now,
    };
    await adminSupabase
      .from("broker_advice")
      .update(update)
      .eq("organization_id", organizationId)
      .eq("id", advice.id);

    await logBrokerActivity(adminSupabase, {
      organizationId,
      clientId: advice.client_id,
      userId,
      type: "advice_signature_declined",
      description: state.declineReason
        ? `Le client a refusé de signer : ${state.declineReason}`
        : "Le client a refusé de signer le devoir de conseil.",
      metadata: { advice_id: advice.id },
    });
    return { changed: true, signed: false, status: "declined" };
  }

  if (state.expired && advice.signature_status !== "expired") {
    await adminSupabase
      .from("broker_advice")
      .update({ signature_status: "expired", updated_at: now })
      .eq("organization_id", organizationId)
      .eq("id", advice.id);

    await logBrokerActivity(adminSupabase, {
      organizationId,
      clientId: advice.client_id,
      userId,
      type: "advice_signature_expired",
      description: "Le lien de signature a expiré sans être signé.",
      metadata: { advice_id: advice.id },
    });
    return { changed: true, signed: false, status: "expired" };
  }

  // Opened but not signed — worth surfacing: the broker knows to follow up.
  if (state.openedAt && !advice.signature_viewed_at) {
    await adminSupabase
      .from("broker_advice")
      .update({
        signature_status: "viewed",
        signature_viewed_at: state.openedAt,
        updated_at: now,
      })
      .eq("organization_id", organizationId)
      .eq("id", advice.id);

    await logBrokerActivity(adminSupabase, {
      organizationId,
      clientId: advice.client_id,
      userId,
      type: "advice_signature_viewed",
      description: "Le client a ouvert le document à signer.",
      metadata: { advice_id: advice.id },
    });
    return { changed: true, signed: false, status: "viewed" };
  }

  return NO_CHANGE;
}

/* -------------------------------------------------------------------------- */

async function completeAdviceSignature(params: {
  adminSupabase: Admin;
  organizationId: string;
  advice: Pick<
    BrokerAdviceRow,
    | "id"
    | "client_id"
    | "created_by"
    | "status"
    | "signature_status"
    | "signed_document_id"
    | "docuseal_submission_id"
  >;
  state: DocusealSubmissionState;
  userId: string | null;
}): Promise<SignatureSyncResult> {
  const { adminSupabase, organizationId, advice, state, userId } = params;
  const now = new Date().toISOString();

  const alreadySigned =
    advice.status === "signed" && advice.signature_status === "completed";
  // Archiving can lag the status update (quota, provider hiccup) — retry it on
  // the next event even when the row already reads "signed".
  const needsArchive = !advice.signed_document_id;
  if (alreadySigned && !needsArchive) return NO_CHANGE;

  const archived = needsArchive
    ? await archiveSignedDocuments({
        adminSupabase,
        organizationId,
        advice,
        state,
      })
    : { signedDocumentId: null, auditLogDocumentId: null };

  const update: AdviceUpdate = {
    status: "signed",
    signature_status: "completed",
    signature_completed_at: state.completedAt ?? now,
    updated_at: now,
    ...(state.openedAt ? { signature_viewed_at: state.openedAt } : {}),
    ...(archived.signedDocumentId
      ? { signed_document_id: archived.signedDocumentId }
      : {}),
    ...(archived.auditLogDocumentId
      ? { audit_log_document_id: archived.auditLogDocumentId }
      : {}),
  };

  const { error } = await adminSupabase
    .from("broker_advice")
    .update(update)
    .eq("organization_id", organizationId)
    .eq("id", advice.id);
  if (error) {
    console.error("[broker] signature completion update failed:", error.message);
    return NO_CHANGE;
  }

  if (!alreadySigned) {
    await logBrokerActivity(adminSupabase, {
      organizationId,
      clientId: advice.client_id,
      userId,
      type: "advice_signed",
      description: archived.signedDocumentId
        ? "Devoir de conseil signé électroniquement — document signé et preuve de signature classés dans le dossier."
        : "Devoir de conseil signé électroniquement.",
      metadata: { advice_id: advice.id },
    });
    await advanceClientStatus(
      adminSupabase,
      organizationId,
      advice.client_id,
      "signed",
    );
  }

  return { changed: true, signed: true, status: "completed" };
}

/**
 * Pulls the countersigned PDF and the audit trail into the dossier's GED.
 *
 * Best-effort by design: a storage quota hit or a provider outage must not stop
 * the signature from being recorded — the broker still has a signed document on
 * the provider side, and the next sync retries the archive.
 */
async function archiveSignedDocuments(params: {
  adminSupabase: Admin;
  organizationId: string;
  advice: Pick<
    BrokerAdviceRow,
    "id" | "client_id" | "created_by" | "docuseal_submission_id"
  >;
  state: DocusealSubmissionState;
}): Promise<{ signedDocumentId: string | null; auditLogDocumentId: string | null }> {
  const { adminSupabase, organizationId, advice, state } = params;
  const empty = { signedDocumentId: null, auditLogDocumentId: null };

  const signedUrl = state.documents[0]?.url ?? null;
  if (!signedUrl) return empty;

  const [{ data: client }, { data: organization }] = await Promise.all([
    adminSupabase
      .from("broker_clients")
      .select("client_type, first_name, last_name, company_name")
      .eq("organization_id", organizationId)
      .eq("id", advice.client_id)
      .maybeSingle(),
    adminSupabase
      .from("organizations")
      .select("storage_used_bytes, storage_limit_bytes")
      .eq("id", organizationId)
      .maybeSingle(),
  ]);
  if (!client || !organization) return empty;

  const clientName = brokerClientDisplayName(client as BrokerClientRow);

  const signed = await downloadSignedDocument(signedUrl);
  if (!signed) return empty;

  const auditLog = state.auditLogUrl
    ? await downloadSignedDocument(state.auditLogUrl)
    : null;

  const totalBytes = signed.bytes.byteLength + (auditLog?.bytes.byteLength ?? 0);
  const usage = computeStorageUsage(organization);
  if (usage.usedBytes + totalBytes > usage.limitBytes) {
    console.error("[broker] signed document archive skipped: storage quota");
    await logBrokerActivity(adminSupabase, {
      organizationId,
      clientId: advice.client_id,
      userId: null,
      type: "advice_signature_archive_skipped",
      description:
        "Document signé non classé : espace de stockage insuffisant. Libérez de l’espace, le classement sera retenté.",
      metadata: { advice_id: advice.id },
    });
    return empty;
  }

  // Scoped to the submission, not just the advice: re-signing an amended
  // document must not overwrite the PDF the client signed the first time — that
  // copy is the evidence of the advice actually delivered back then. Retrying
  // the SAME submission still lands on the same path, so no duplicates.
  const round = advice.docuseal_submission_id ?? "manuel";

  const signedDocumentId = await storeDocument({
    adminSupabase,
    organizationId,
    clientId: advice.client_id,
    uploadedBy: advice.created_by,
    fileName: `devoir-de-conseil-${advice.id}-signe-${round}.pdf`,
    title: `Devoir de conseil signé — ${clientName}`,
    category: "advice_document",
    bytes: signed.bytes,
    contentType: "application/pdf",
  });

  const auditLogDocumentId = auditLog
    ? await storeDocument({
        adminSupabase,
        organizationId,
        clientId: advice.client_id,
        uploadedBy: advice.created_by,
        fileName: `devoir-de-conseil-${advice.id}-preuve-${round}.pdf`,
        title: `Preuve de signature — ${clientName}`,
        category: "other",
        bytes: auditLog.bytes,
        contentType: "application/pdf",
      })
    : null;

  return { signedDocumentId, auditLogDocumentId };
}

async function storeDocument(params: {
  adminSupabase: Admin;
  organizationId: string;
  clientId: string;
  uploadedBy: string;
  fileName: string;
  title: string;
  category: string;
  bytes: Buffer;
  contentType: string;
}): Promise<string | null> {
  const {
    adminSupabase,
    organizationId,
    clientId,
    uploadedBy,
    fileName,
    title,
    category,
    bytes,
    contentType,
  } = params;

  const storagePath = `${organizationId}/${clientId}/${fileName}`;

  // Re-signing replaces the previous copy rather than piling up duplicates.
  const { data: existing } = await adminSupabase
    .from("broker_documents")
    .select("id, size_bytes")
    .eq("organization_id", organizationId)
    .eq("storage_path", storagePath)
    .maybeSingle();

  const { error: uploadError } = await adminSupabase.storage
    .from(BROKER_FILES_BUCKET)
    .upload(storagePath, bytes, { contentType, upsert: true });
  if (uploadError) {
    console.error("[broker] signed document upload failed:", uploadError.message);
    return null;
  }

  if (existing) {
    await adminSupabase.from("broker_documents").delete().eq("id", existing.id);
  }

  const { data: inserted, error: insertError } = await adminSupabase
    .from("broker_documents")
    .insert({
      organization_id: organizationId,
      client_id: clientId,
      uploaded_by: uploadedBy,
      category,
      title,
      file_name: fileName,
      storage_path: storagePath,
      mime_type: contentType,
      size_bytes: bytes.byteLength,
      status: "stored",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error(
      "[broker] signed document insert failed:",
      insertError?.message ?? "insert_failed",
    );
    await adminSupabase.storage.from(BROKER_FILES_BUCKET).remove([storagePath]);
    return null;
  }

  await adjustOrganizationStorage(
    adminSupabase,
    organizationId,
    bytes.byteLength - (existing?.size_bytes ?? 0),
  );

  return inserted.id;
}
