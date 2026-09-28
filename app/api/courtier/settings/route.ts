import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canManageWorkspace } from "@/lib/auth/workspace-permissions";
import { brokerInsuranceTypes } from "@/lib/broker/clients";
import {
  emptyCabinetComplianceInfo,
  type CabinetComplianceInfo,
} from "@/lib/broker/compliance";
import { requireBrokerApiContext } from "@/lib/broker/server";
import { parseCabinetCompliance } from "@/lib/broker/settings";

/**
 * Paths to files (logo, legal annexes). Set only by the upload route, which
 * checks what it stores — a fiche saved from the form keeps the stored values,
 * so a crafted payload can't point the PDF renderer somewhere else.
 */
const ASSET_KEYS = new Set<keyof CabinetComplianceInfo>([
  "logoUrl",
  "annexEntreeEnRelation",
  "annexMentions",
]);

function mergeFiche(
  stored: CabinetComplianceInfo,
  incoming: Partial<Record<keyof CabinetComplianceInfo, string>>,
): CabinetComplianceInfo {
  const merged = emptyCabinetComplianceInfo();
  for (const key of Object.keys(merged) as (keyof CabinetComplianceInfo)[]) {
    if (ASSET_KEYS.has(key)) {
      merged[key] = stored[key];
      continue;
    }
    const value = incoming[key];
    if (typeof value === "string") merged[key] = value.trim();
  }
  return merged;
}

const complianceField = z.string().trim().max(600);

const schema = z.object({
  enabledBranches: z.array(z.enum(brokerInsuranceTypes)).optional(),
  partnerInsurers: z
    .array(z.string().trim().min(1).max(80))
    .max(60)
    .optional(),
  complianceEnabled: z.boolean().optional(),
  introducersEnabled: z.boolean().optional(),
  compliance: z
    .object({
      legalName: complianceField,
      legalForm: complianceField,
      capital: complianceField,
      siren: complianceField,
      rcsCity: complianceField,
      address: complianceField,
      email: complianceField,
      phone: complianceField,
      website: complianceField,
      manager: complianceField,
      oriasNumber: complianceField,
      oriasCategories: complianceField,
      adviceScope: complianceField,
      financialLinks: complianceField,
      remuneration: complianceField,
      rcpInsurer: complianceField,
      rcpInsurerAddress: complianceField,
      rcpReference: complianceField,
      financialGuarantee: complianceField,
      acprStatement: complianceField,
      claimsAddress: complianceField,
      claimsEmail: complianceField,
      claimsDelay: complianceField,
      mediatorName: complianceField,
      mediatorAddress: complianceField,
      mediatorEmail: complianceField,
      mediatorUrl: complianceField,
      dpoMode: complianceField,
      dpoContact: complianceField,
    })
    .partial()
    .optional(),
  /** Save the fiche onto this profile (its own company) instead of the cabinet. */
  profileId: z.string().uuid().optional(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canManageWorkspace(auth.context.membership?.role)) {
    return jsonError(
      "Seul un gestionnaire peut modifier ces paramètres.",
      403,
      "insufficient_role",
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Paramètres invalides.", 400, "invalid_payload");
  }

  if (parsed.data.profileId) {
    if (parsed.data.compliance === undefined) {
      return jsonError("Paramètres invalides.", 400, "invalid_payload");
    }
    const { data: profile } = await auth.adminSupabase
      .from("broker_profiles")
      .select("id, cabinet")
      .eq("organization_id", auth.organizationId)
      .eq("id", parsed.data.profileId)
      .maybeSingle();
    if (!profile) return jsonError("Profil introuvable.", 404, "profile_not_found");

    const fiche = mergeFiche(
      parseCabinetCompliance(profile.cabinet),
      parsed.data.compliance,
    );
    const { error } = await auth.adminSupabase
      .from("broker_profiles")
      .update({ cabinet: fiche, updated_at: new Date().toISOString() })
      .eq("organization_id", auth.organizationId)
      .eq("id", profile.id);
    if (error) return jsonError("Enregistrement impossible.", 500, error.message);
    return NextResponse.json({ success: true });
  }

  const current =
    (auth.context.organization?.broker_settings as Record<string, unknown>) ??
    {};
  const next = { ...current };
  if (parsed.data.enabledBranches !== undefined) {
    next.enabledBranches = [...new Set(parsed.data.enabledBranches)];
  }
  if (parsed.data.partnerInsurers !== undefined) {
    next.partnerInsurers = [
      ...new Set(parsed.data.partnerInsurers.map((s) => s.trim())),
    ];
  }
  if (parsed.data.complianceEnabled !== undefined) {
    next.complianceEnabled = parsed.data.complianceEnabled;
  }
  if (parsed.data.introducersEnabled !== undefined) {
    next.introducersEnabled = parsed.data.introducersEnabled;
  }
  if (parsed.data.compliance !== undefined) {
    next.compliance = mergeFiche(
      parseCabinetCompliance(current.compliance),
      parsed.data.compliance,
    );
  }

  const { error } = await auth.adminSupabase
    .from("organizations")
    .update({ broker_settings: next })
    .eq("id", auth.organizationId);

  if (error) {
    return jsonError("Enregistrement impossible.", 500, error.message);
  }

  return NextResponse.json({ success: true });
}
