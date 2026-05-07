import { PageTransition } from "@/components/common/page-transition";
import { GeneralSettingsForm } from "@/components/settings/general-settings-form";

export default function SettingsPage() {
  return (
    <PageTransition>
      <GeneralSettingsForm />
    </PageTransition>
  );
}
