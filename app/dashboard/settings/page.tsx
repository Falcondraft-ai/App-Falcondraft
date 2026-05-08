import { PageTransition } from "@/components/common/page-transition";
import { GeneralSettingsForm } from "@/components/settings/general-settings-form";
import { requireCurrentUserContext } from "@/lib/auth/session";

export default async function SettingsPage() {
  const context = await requireCurrentUserContext();
  const organization = context.organization;
  const userName =
    context.profile?.full_name ?? context.user.email ?? "Utilisateur";

  return (
    <PageTransition>
      <GeneralSettingsForm
        organizationName={organization?.name ?? "Espace client"}
        defaultLanguage="Français"
        userName={userName}
        userEmail={context.user.email ?? ""}
      />
    </PageTransition>
  );
}
