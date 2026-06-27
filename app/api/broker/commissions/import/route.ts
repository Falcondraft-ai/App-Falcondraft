import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  BROKER_FILES_BUCKET,
  MAX_DOCUMENT_SIZE_BYTES,
  sanitizeFileName,
} from "@/lib/broker/documents";
import {
  type IntroducerLite,
  resolveRetrocession,
} from "@/lib/broker/introducers";
import {
  adjustOrganizationStorage,
  requireBrokerApiContext,
} from "@/lib/broker/server";
import { canUploadWithinQuota, computeStorageUsage } from "@/lib/broker/storage";

export const runtime = "nodejs";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable();

const lineSchema = z.object({
  insurerName: z.string().trim().max(160).optional().nullable(),
  label: z.string().trim().max(255).optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
  baseAmount: z.number().finite().optional().nullable(),
  rate: z.number().finite().optional().nullable(),
  commissionAmount: z.number().finite().optional().nullable(),
  retrocessionRate: z.number().finite().optional().nullable(),
  retrocessionAmount: z.number().finite().optional().nullable(),
  retrocessionBeneficiary: z.string().trim().max(160).optional().nullable(),
  periodLabel: z.string().trim().max(80).optional().nullable(),
  currency: z.string().trim().max(8).optional(),
});

const payloadSchema = z.object({
  statement: z.object({
    insurerName: z.string().trim().max(160).optional().nullable(),
    periodLabel: z.string().trim().max(80).optional().nullable(),
    periodStart: dateString,
    periodEnd: dateString,
    totalAmount: z.number().finite().optional().nullable(),
    currency: z.string().trim().max(8).optional(),
  }),
  lines: z.array(lineSchema).max(2000),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/**
 * Persists a reviewed bordereau: archives the source file (org-scoped), creates
 * the statement, and inserts the confirmed commission lines. Fully transactional
 * in spirit — any failure rolls back the uploaded file (and the statement).
 */
export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas d’importer un bordereau.",
      403,
      "insufficient_role",
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Requête illisible.", 400, "invalid_form");
  }

  const dataRaw = form.get("data");
  if (typeof dataRaw !== "string") {
    return jsonError("Données manquantes.", 400, "no_data");
  }
  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(JSON.parse(dataRaw));
  } catch {
    return jsonError("Données invalides.", 400, "invalid_payload");
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError("Le bordereau (fichier) est requis.", 400, "no_file");
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return jsonError("Fichier trop volumineux (max 50 Mo).", 413, "too_large");
  }

  const usage = computeStorageUsage(auth.context.organization);
  if (!canUploadWithinQuota(usage, file.size)) {
    return jsonError(
      "Espace de stockage insuffisant pour archiver ce bordereau.",
      507,
      "storage_full",
    );
  }

  // ---- Validate referenced clients/contracts belong to this org ------------
  const clientIds = [
    ...new Set(
      payload.lines.map((l) => l.clientId).filter((v): v is string => !!v),
    ),
  ];
  const contractIds = [
    ...new Set(
      payload.lines.map((l) => l.contractId).filter((v): v is string => !!v),
    ),
  ];

  const validClients = new Set<string>();
  const validContracts = new Set<string>();
  const contractClient = new Map<string, string>();

  if (clientIds.length) {
    const { data } = await auth.adminSupabase
      .from("broker_clients")
      .select("id")
      .eq("organization_id", auth.organizationId)
      .in("id", clientIds);
    for (const r of data ?? []) validClients.add(r.id);
  }
  if (contractIds.length) {
    const { data } = await auth.adminSupabase
      .from("broker_contracts")
      .select("id, client_id")
      .eq("organization_id", auth.organizationId)
      .in("id", contractIds);
    for (const r of data ?? []) {
      validContracts.add(r.id);
      if (r.client_id) contractClient.set(r.id, r.client_id);
    }
  }

  // ---- Resolve each line's introducer (for auto retrocessions) -------------
  const finalClientIds = new Set<string>();
  for (const l of payload.lines) {
    let cid = l.clientId && validClients.has(l.clientId) ? l.clientId : null;
    const ctr = l.contractId && validContracts.has(l.contractId) ? l.contractId : null;
    if (!cid && ctr) cid = contractClient.get(ctr) ?? null;
    if (cid) finalClientIds.add(cid);
  }
  const clientIntroducer = new Map<string, IntroducerLite>();
  if (finalClientIds.size) {
    const { data: clientRows } = await auth.adminSupabase
      .from("broker_clients")
      .select("id, introducer_id")
      .eq("organization_id", auth.organizationId)
      .in("id", [...finalClientIds]);
    const introIds = [
      ...new Set(
        (clientRows ?? [])
          .map((r) => r.introducer_id)
          .filter((v): v is string => !!v),
      ),
    ];
    const introById = new Map<string, IntroducerLite>();
    if (introIds.length) {
      const { data: intros } = await auth.adminSupabase
        .from("broker_introducers")
        .select("id, name, retrocession_rate")
        .eq("organization_id", auth.organizationId)
        .in("id", introIds);
      for (const i of intros ?? []) {
        introById.set(i.id, { id: i.id, name: i.name, rate: i.retrocession_rate });
      }
    }
    for (const r of clientRows ?? []) {
      if (r.introducer_id) {
        const intro = introById.get(r.introducer_id);
        if (intro) clientIntroducer.set(r.id, intro);
      }
    }
  }

  // ---- Archive the source file --------------------------------------------
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = sanitizeFileName(file.name);
  const storagePath = `${auth.organizationId}/commissions/${randomUUID()}/${safeName}`;

  const { error: uploadError } = await auth.adminSupabase.storage
    .from(BROKER_FILES_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) {
    return jsonError(
      "Archivage du bordereau impossible.",
      500,
      uploadError.message,
    );
  }

  const defaultCurrency = payload.statement.currency?.trim() || "EUR";

  // ---- Create the statement ------------------------------------------------
  const { data: statement, error: stmtError } = await auth.adminSupabase
    .from("broker_commission_statements")
    .insert({
      organization_id: auth.organizationId,
      created_by: auth.user.id,
      insurer_name: payload.statement.insurerName?.trim() || null,
      period_label: payload.statement.periodLabel?.trim() || null,
      period_start: payload.statement.periodStart ?? null,
      period_end: payload.statement.periodEnd ?? null,
      total_amount: payload.statement.totalAmount ?? null,
      currency: defaultCurrency,
      status: "received",
      source_storage_path: storagePath,
      source_file_name: file.name.slice(0, 255),
      source_mime_type: file.type || null,
      source_size_bytes: file.size,
    })
    .select("id")
    .single();

  if (stmtError || !statement) {
    await auth.adminSupabase.storage
      .from(BROKER_FILES_BUCKET)
      .remove([storagePath]);
    return jsonError(
      "Création du bordereau impossible.",
      500,
      stmtError?.message ?? "insert_failed",
    );
  }

  // ---- Insert the commission lines ----------------------------------------
  if (payload.lines.length) {
    const rows = payload.lines.map((l) => {
      const contractId =
        l.contractId && validContracts.has(l.contractId) ? l.contractId : null;
      let clientId =
        l.clientId && validClients.has(l.clientId) ? l.clientId : null;
      if (!clientId && contractId) {
        clientId = contractClient.get(contractId) ?? null;
      }
      const retro = resolveRetrocession({
        commissionAmount: l.commissionAmount ?? null,
        retrocessionAmount: l.retrocessionAmount ?? null,
        retrocessionRate: l.retrocessionRate ?? null,
        retrocessionBeneficiary: l.retrocessionBeneficiary ?? null,
        introducer: clientId ? clientIntroducer.get(clientId) ?? null : null,
      });
      return {
        organization_id: auth.organizationId,
        created_by: auth.user.id,
        statement_id: statement.id,
        contract_id: contractId,
        client_id: clientId,
        insurer_name:
          l.insurerName?.trim() ||
          payload.statement.insurerName?.trim() ||
          null,
        label: l.label?.trim() || null,
        base_amount: l.baseAmount ?? null,
        rate: l.rate ?? null,
        commission_amount: l.commissionAmount ?? null,
        retrocession_rate: retro.retrocession_rate,
        retrocession_amount: retro.retrocession_amount,
        retrocession_beneficiary: retro.retrocession_beneficiary,
        introducer_id: retro.introducer_id,
        period_label:
          l.periodLabel?.trim() ||
          payload.statement.periodLabel?.trim() ||
          null,
        currency: l.currency?.trim() || defaultCurrency,
        status: "received",
      };
    });

    const { error: linesError } = await auth.adminSupabase
      .from("broker_commissions")
      .insert(rows);

    if (linesError) {
      // Roll back the statement and the archived file.
      await auth.adminSupabase
        .from("broker_commission_statements")
        .delete()
        .eq("id", statement.id)
        .eq("organization_id", auth.organizationId);
      await auth.adminSupabase.storage
        .from(BROKER_FILES_BUCKET)
        .remove([storagePath]);
      return jsonError(
        "Enregistrement des lignes impossible.",
        500,
        linesError.message,
      );
    }
  }

  await adjustOrganizationStorage(
    auth.adminSupabase,
    auth.organizationId,
    file.size,
  );

  return NextResponse.json({ success: true, statementId: statement.id });
}
