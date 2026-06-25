import { ComplianceSettingsForm } from "@/components/broker/compliance-settings-form";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { canManageWorkspace } from "@/lib/auth/workspace-permissions";
import { parseBrokerSettings } from "@/lib/broker/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CourtierComplianceSettingsPage() {
  const context = await requireActiveWorkspaceContext();
  const settings = parseBrokerSettings(context.organization);
  const canEdit = canManageWorkspace(context.membership?.role);

  return (
    <ComplianceSettingsForm
      initial={settings.compliance}
      initialEnabled={settings.complianceEnabled}
      canEdit={canEdit}
    />
  );
}
