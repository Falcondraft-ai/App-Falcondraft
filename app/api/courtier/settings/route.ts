import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canManageWorkspace } from "@/lib/auth/workspace-permissions";
import { brokerInsuranceTypes } from "@/lib/broker/clients";
import { emptyCabinetComplianceInfo } from "@/lib/broker/compliance";
import { requireBrokerApiContext } from "@/lib/broker/server";

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
      logoUrl: complianceField,
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
    const base = emptyCabinetComplianceInfo();
    const incoming = parsed.data.compliance;
    const merged = { ...base };
    for (const key of Object.keys(base) as (keyof typeof base)[]) {
      const value = incoming[key];
      if (typeof value === "string") merged[key] = value.trim();
    }
    next.compliance = merged;
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
