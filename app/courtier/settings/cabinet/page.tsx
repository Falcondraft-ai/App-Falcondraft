import { CabinetSettingsForm, type CabinetEntity } from "@/components/broker/compliance-settings-form";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { canManageWorkspace } from "@/lib/auth/workspace-permissions";
import { CABINET_BRANDING_FOLDER, profileCabinetFiche } from "@/lib/broker/cabinet";
import type { CabinetComplianceInfo } from "@/lib/broker/compliance";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import { getBrokerProfiles } from "@/lib/broker/profiles";
import { parseBrokerSettings, parseCabinetCompliance } from "@/lib/broker/settings";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ASSET_KEYS = ["logoUrl", "annexEntreeEnRelation", "annexMentions"] as const;

export default async function CourtierCabinetSettingsPage() {
  const context = await requireActiveWorkspaceContext();
  // requireActiveWorkspaceContext redirects when there is none; the type can't tell.
  const organizationId = context.organization?.id;
  if (!organizationId) return null;
  const settings = parseBrokerSettings(context.organization);
  const canEdit = canManageWorkspace(context.membership?.role);
  const profiles = await getBrokerProfiles(organizationId);
  const admin = getSupabaseAdminClient();

  /** A short-lived link to look at a filed asset — never the raw Storage path. */
  async function assetLinks(fiche: CabinetComplianceInfo) {
    const links: CabinetEntity["assets"] = {
      logoUrl: null,
      annexEntreeEnRelation: null,
      annexMentions: null,
    };
    for (const key of ASSET_KEYS) {
      const ref = fiche[key]?.trim();
      if (!ref) continue;
      if (ref.startsWith("/") && !ref.includes("..")) {
        links[key] = ref;
      } else if (admin && ref.startsWith(`${organizationId}/${CABINET_BRANDING_FOLDER}/`)) {
        const { data } = await admin.storage
          .from(BROKER_FILES_BUCKET)
          .createSignedUrl(ref, 60 * 10);
        links[key] = data?.signedUrl ?? null;
      }
    }
    return links;
  }

  const entities: CabinetEntity[] = [
    {
      profileId: null,
      label: "Cabinet",
      fiche: settings.compliance,
      hasOwnFiche: settings.compliance.legalName.trim().length > 0,
      assets: await assetLinks(settings.compliance),
    },
  ];
  for (const profile of profiles) {
    const fiche = parseCabinetCompliance(profile.cabinet);
    entities.push({
      profileId: profile.id,
      label: profile.display_name,
      fiche,
      hasOwnFiche: profileCabinetFiche(profile) !== null,
      assets: await assetLinks(fiche),
    });
  }

  return <CabinetSettingsForm entities={entities} canEdit={canEdit} />;
}
