import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import { BROKER_FILES_BUCKET, sanitizeFileName } from "@/lib/broker/documents";
import { normalizeImportDocCategory } from "@/lib/broker/imports";
import { normalizeAttachmentCategory } from "@/lib/broker/outlook";
import {
  adjustOrganizationStorage,
  logBrokerActivity,
  requireBrokerApiContext,
} from "@/lib/broker/server";
import { computeStorageUsage } from "@/lib/broker/storage";
import {
  companyEmailDomain,
  getFileAttachmentBytes,
  getMessageAttachmentsMeta,
  getOutlookAccessForUser,
  searchMessagesForClient,
} from "@/lib/email/outlook-read";
import type { BrokerClientRow, BrokerImportGroupRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Committed clients scanned per call (bounds Graph calls within the budget). */
const SCAN_CLIENT_LIMIT = 15;
const MESSAGES_PER_CLIENT = 15;

type RouteContext = { params: Promise<{ batchId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/** Cheap filename-based category guess for an attachment. */
function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (/(cni|carte.?identit|passeport|permis)/.test(n)) return "id_document";
  if (/(rib|iban)/.test(n)) return "rib";
  if (/(devis|cotation|tarif)/.test(n)) return "company_quote";
  if (/(contrat|police|attestation|avenant)/.test(n)) return "contract";
  return "other";
}

const attachSchema = z.object({
  action: z.literal("attach"),
  items: z
    .array(
      z.object({
        clientId: z.string().uuid(),
        messageId: z.string().min(1),
        attachmentId: z.string().min(1),
        fileName: z.string().min(1).max(300),
        contentType: z.string().max(200).optional(),
        category: z.string().max(40).optional(),
      }),
    )
    .min(1)
    .max(50),
});
const scanSchema = z.object({ action: z.literal("scan") });
const bodySchema = z.union([scanSchema, attachSchema]);

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Action non autorisée pour votre rôle.", 403, "insufficient_role");
  }

  const { batchId } = await ctx.params;
  const admin = auth.adminSupabase;
  const orgId = auth.organizationId;
  const userId = auth.user.id;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError("Requête invalide.", 400, "invalid_payload");

  const access = await getOutlookAccessForUser(orgId, userId);
  if (!access) {
    return jsonError(
      "Connectez votre boîte Outlook pour récupérer les emails des clients.",
      409,
      "not_connected",
    );
  }

  // -------------------------------------------------------------- SCAN
  if (parsed.data.action === "scan") {
    // Clients created/linked by this batch that carry an email.
    const { data: groupRows } = await admin
      .from("broker_import_groups")
      .select("created_client_id")
      .eq("organization_id", orgId)
      .eq("batch_id", batchId)
      .eq("status", "committed")
      .not("created_client_id", "is", null);
    const clientIds = [
      ...new Set(
        (groupRows ?? [])
          .map((g) => (g as Pick<BrokerImportGroupRow, "created_client_id">).created_client_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ].slice(0, SCAN_CLIENT_LIMIT);

    if (clientIds.length === 0) {
      return NextResponse.json({ clients: [], mailbox: access.email });
    }

    const { data: clientRows } = await admin
      .from("broker_clients")
      .select("*")
      .eq("organization_id", orgId)
      .in("id", clientIds);
    const clients = ((clientRows ?? []) as BrokerClientRow[]).filter((c) => c.email);

    const results = await Promise.all(
      clients.map(async (client) => {
        const displayName = brokerClientDisplayName(client);
        const messages = await searchMessagesForClient(
          access.accessToken,
          {
            emails: client.email ? [client.email.trim().toLowerCase()] : [],
            names: [displayName],
            references: [],
            domain: companyEmailDomain(
              client.email,
              client.client_type === "company",
            ),
          },
          undefined,
          MESSAGES_PER_CLIENT,
          3,
        );
        const withAttachments = messages.filter((m) => m.hasAttachments);
        const attachments = (
          await Promise.all(
            withAttachments.map(async (m) => {
              const metas = await getMessageAttachmentsMeta(access.accessToken, m.id);
              return metas.map((meta) => ({
                ref: `${m.id}:${meta.id}`,
                messageId: m.id,
                attachmentId: meta.id,
                fileName: meta.name,
                contentType: meta.contentType,
                size: meta.size,
                subject: m.subject,
                receivedAt: m.receivedDateTime,
                suggestedCategory: guessCategory(meta.name),
              }));
            }),
          )
        ).flat();

        return {
          clientId: client.id,
          clientName: brokerClientDisplayName(client),
          email: client.email,
          attachments,
        };
      }),
    );

    return NextResponse.json({
      clients: results.filter((r) => r.attachments.length > 0),
      mailbox: access.email,
    });
  }

  // -------------------------------------------------------------- ATTACH
  const usage = computeStorageUsage(auth.context.organization);
  let used = usage.usedBytes;
  const limit = usage.limitBytes;
  let filed = 0;

  for (const item of parsed.data.items) {
    // Security: the target client must belong to the organization.
    const { data: client } = await admin
      .from("broker_clients")
      .select("id")
      .eq("organization_id", orgId)
      .eq("id", item.clientId)
      .maybeSingle();
    if (!client) continue;

    const file = await getFileAttachmentBytes(
      access.accessToken,
      item.messageId,
      item.attachmentId,
    );
    if (!file) continue;
    const buffer = Buffer.from(file.contentBase64, "base64");
    if (used + buffer.byteLength > limit) {
      return jsonError(
        "Quota de stockage atteint : certaines pièces n'ont pas pu être rangées.",
        413,
        "storage_quota_exceeded",
      );
    }

    const fileName = item.fileName || file.name;
    const contentType = item.contentType || file.contentType;
    const path = `${orgId}/${item.clientId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
    const { error: uploadError } = await admin.storage
      .from(BROKER_FILES_BUCKET)
      .upload(path, buffer, { contentType, upsert: false });
    if (uploadError) {
      console.error("[import] email attachment upload failed:", uploadError.message);
      continue;
    }

    const category = item.category
      ? normalizeImportDocCategory(item.category)
      : normalizeAttachmentCategory(null);
    const { error: docError } = await admin.from("broker_documents").insert({
      organization_id: orgId,
      client_id: item.clientId,
      uploaded_by: userId,
      category,
      title: fileName,
      file_name: fileName,
      storage_path: path,
      mime_type: contentType,
      size_bytes: buffer.byteLength,
      status: "stored",
    });
    if (docError) {
      await admin.storage.from(BROKER_FILES_BUCKET).remove([path]);
      continue;
    }

    await adjustOrganizationStorage(admin, orgId, buffer.byteLength);
    await logBrokerActivity(admin, {
      organizationId: orgId,
      clientId: item.clientId,
      userId,
      type: "document_added",
      description: `Pièce jointe d'un email rangée à l'import : ${fileName}.`,
      metadata: { category, import_batch_id: batchId },
    });
    used += buffer.byteLength;
    filed += 1;
  }

  return NextResponse.json({ success: true, filed });
}
