import { PageTransition } from "@/components/common/page-transition";
import { GeneralSettingsForm } from "@/components/settings/general-settings-form";
import { requireCurrentUserContext } from "@/lib/auth/session";

export default async function SettingsPage() {
  const context = await requireCurrentUserContext();
  const organization = context.organization;

  return (
    <PageTransition>
      <GeneralSettingsForm
        organizationName={organization?.name ?? "Espace client"}
        organizationSlug={organization?.slug ?? "espace-client"}
        defaultLanguage="Français"
      />
    </PageTransition>
  );
}
