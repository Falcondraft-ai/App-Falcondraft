import { PageTransition } from "@/components/common/page-transition";
import { GeneralSettingsForm } from "@/components/settings/general-settings-form";
import { requireCurrentUserContext } from "@/lib/auth/session";
import type { Json } from "@/types/database";

function isRecord(value: Json | null | undefined): value is Record<string, Json> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(metadata: Json, key: string, fallback: string) {
  if (!isRecord(metadata)) {
    return fallback;
  }

  const value = metadata[key];

  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export default async function SettingsPage() {
  const context = await requireCurrentUserContext();
  const organization = context.organization;

  return (
    <PageTransition>
      <GeneralSettingsForm
        organizationName={organization?.name ?? "Espace client"}
        organizationSlug={organization?.slug ?? "espace-client"}
        defaultLanguage={readString(
          organization?.metadata ?? {},
          "defaultLanguage",
          "Français",
        )}
      />
    </PageTransition>
  );
}
