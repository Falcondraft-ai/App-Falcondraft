import { ContractSettingsForm } from "@/components/broker/contract-settings-form";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { canManageWorkspace } from "@/lib/auth/workspace-permissions";
import { parseBrokerSettings } from "@/lib/broker/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CourtierContractSettingsPage() {
  const context = await requireActiveWorkspaceContext();
  const settings = parseBrokerSettings(context.organization);
  const canEdit = canManageWorkspace(context.membership?.role);

  return (
    <ContractSettingsForm
      initialBranches={settings.enabledBranches}
      initialInsurers={settings.partnerInsurers}
      canEdit={canEdit}
    />
  );
}
