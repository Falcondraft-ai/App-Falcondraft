import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerRiskLevels } from "@/lib/broker/compliance";
import { logBrokerActivity, requireBrokerApiContext } from "@/lib/broker/server";
import type { BrokerComplianceRow, Database } from "@/types/database";

type BrokerComplianceUpdate =
  Database["public"]["Tables"]["broker_compliance"]["Update"];

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  identityVerified: z.boolean().optional(),
  identityDocumentId: z.string().uuid().optional().nullable(),
  riskLevel: z.enum(brokerRiskLevels).optional().nullable(),
  isPep: z.boolean().optional(),
  pepDetails: z.string().trim().max(2000).optional().nullable(),
  fundsOrigin: z.string().trim().max(2000).optional().nullable(),
  lcbftNotes: z.string().trim().max(5000).optional().nullable(),
  consentDataProcessing: z.boolean().optional(),
  consentMarketing: z.boolean().optional(),
  erasureRequested: z.boolean().optional(),
  infoSheetDelivered: z.boolean().optional(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas de modifier la conformité.",
      403,
      "insufficient_role",
    );
  }

  const { id: clientId } = await ctx.params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Requête invalide.", 400, "invalid_payload");
  }
  const values = parsed.data;

  const { data: client } = await auth.adminSupabase
    .from("broker_clients")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return jsonError("Dossier introuvable.", 404, "client_not_found");
  }

  if (values.identityDocumentId) {
    const { data: doc } = await auth.adminSupabase
      .from("broker_documents")
      .select("id")
      .eq("organization_id", auth.organizationId)
      .eq("client_id", clientId)
      .eq("id", values.identityDocumentId)
      .maybeSingle();
    if (!doc) {
      return jsonError("Document d’identité introuvable.", 404, "document_not_found");
    }
  }

  const { data: existing } = await auth.adminSupabase
    .from("broker_compliance")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .maybeSingle();

  const prev = (existing as BrokerComplianceRow | null) ?? null;
  const now = new Date().toISOString();
  const update: BrokerComplianceUpdate = {
    updated_by: auth.user.id,
    updated_at: now,
  };
  const activityEvents: { type: string; description: string }[] = [];

  if (values.identityVerified !== undefined) {
    update.identity_verified = values.identityVerified;
    if (values.identityVerified && !prev?.identity_verified) {
      update.identity_verified_at = now;
      update.identity_verified_by = auth.user.id;
      activityEvents.push({
        type: "identity_verified",
        description: "Identité du client vérifiée (LCB-FT).",
      });
    }
    if (!values.identityVerified) {
      update.identity_verified_at = null;
      update.identity_verified_by = null;
    }
  }
  if (values.identityDocumentId !== undefined)
    update.identity_document_id = values.identityDocumentId ?? null;
  if (values.riskLevel !== undefined) update.risk_level = values.riskLevel;
  if (values.isPep !== undefined) update.is_pep = values.isPep;
  if (values.pepDetails !== undefined)
    update.pep_details = trimmedOrNull(values.pepDetails);
  if (values.fundsOrigin !== undefined)
    update.funds_origin = trimmedOrNull(values.fundsOrigin);
  if (values.lcbftNotes !== undefined)
    update.lcbft_notes = trimmedOrNull(values.lcbftNotes);

  if (values.consentDataProcessing !== undefined) {
    update.consent_data_processing = values.consentDataProcessing;
    if (values.consentDataProcessing && !prev?.consent_data_processing) {
      update.consent_data_processing_at = now;
      activityEvents.push({
        type: "consent_recorded",
        description: "Consentement RGPD au traitement des données enregistré.",
      });
    }
    if (!values.consentDataProcessing) update.consent_data_processing_at = null;
  }
  if (values.consentMarketing !== undefined) {
    update.consent_marketing = values.consentMarketing;
    if (values.consentMarketing && !prev?.consent_marketing) {
      update.consent_marketing_at = now;
    }
    if (!values.consentMarketing) update.consent_marketing_at = null;
  }
  if (values.erasureRequested !== undefined) {
    update.erasure_requested = values.erasureRequested;
    if (values.erasureRequested && !prev?.erasure_requested) {
      update.erasure_requested_at = now;
      activityEvents.push({
        type: "erasure_requested",
        description: "Demande d’effacement RGPD enregistrée.",
      });
    }
    if (!values.erasureRequested) update.erasure_requested_at = null;
  }
  if (values.infoSheetDelivered !== undefined) {
    update.info_sheet_delivered = values.infoSheetDelivered;
    if (values.infoSheetDelivered && !prev?.info_sheet_delivered) {
      update.info_sheet_delivered_at = now;
    }
    if (!values.infoSheetDelivered) update.info_sheet_delivered_at = null;
  }

  if (prev) {
    const { error } = await auth.adminSupabase
      .from("broker_compliance")
      .update(update)
      .eq("organization_id", auth.organizationId)
      .eq("id", prev.id);
    if (error) {
      return jsonError("Enregistrement impossible.", 500, error.message);
    }
  } else {
    const { error } = await auth.adminSupabase.from("broker_compliance").insert({
      organization_id: auth.organizationId,
      client_id: clientId,
      created_by: auth.user.id,
      ...update,
    });
    if (error) {
      return jsonError("Enregistrement impossible.", 500, error.message);
    }
  }

  if (activityEvents.length > 0) {
    for (const event of activityEvents) {
      await logBrokerActivity(auth.adminSupabase, {
        organizationId: auth.organizationId,
        clientId,
        userId: auth.user.id,
        type: event.type,
        description: event.description,
      });
    }
  } else {
    await logBrokerActivity(auth.adminSupabase, {
      organizationId: auth.organizationId,
      clientId,
      userId: auth.user.id,
      type: "compliance_updated",
      description: "Dossier de conformité mis à jour.",
    });
  }

  return NextResponse.json({ success: true });
}
