"use client";

import { useTheme } from "next-themes";
import * as React from "react";
import { toast } from "sonner";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { useI18n } from "@/components/i18n/language-provider";
import { ProfilePhotoControl } from "@/components/settings/profile-photo-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SETTINGS_PREFERENCES_STORAGE_KEY = "falcondraft:settings-preferences";

type SettingsPreferences = {
  organizationName: string;
  askExpectedCloseDate: boolean;
};

function getDefaultPreferences(organizationName: string): SettingsPreferences {
  return {
    organizationName,
    askExpectedCloseDate: false,
  };
}

function readStoredPreferences(
  fallback: SettingsPreferences,
): SettingsPreferences {
  try {
    const storedValue = window.localStorage.getItem(
      SETTINGS_PREFERENCES_STORAGE_KEY,
    );

    if (!storedValue) {
      return fallback;
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    if (!parsedValue || typeof parsedValue !== "object") {
      return fallback;
    }

    return {
      ...fallback,
      ...Object.fromEntries(
        Object.entries(parsedValue).filter(([key, value]) => {
          if (!(key in fallback)) {
            return false;
          }

          return typeof value === "string" || typeof value === "boolean";
        }),
      ),
    };
  } catch {
    return fallback;
  }
}

export function GeneralSettingsForm({
  organizationName,
  userName,
  userEmail,
}: {
  organizationName: string;
  userName: string;
  userEmail: string;
}) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [isMounted, setIsMounted] = React.useState(false);
  const fallbackPreferences = React.useMemo(
    () => getDefaultPreferences(organizationName),
    [organizationName],
  );
  const [preferences, setPreferences] =
    React.useState<SettingsPreferences>(fallbackPreferences);

  React.useEffect(() => {
    setIsMounted(true);
    setPreferences(readStoredPreferences(fallbackPreferences));
  }, [fallbackPreferences]);

  function updatePreference<Key extends keyof SettingsPreferences>(
    key: Key,
    value: SettingsPreferences[Key],
  ) {
    setPreferences((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function savePreferences() {
    window.localStorage.setItem(
      SETTINGS_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
    toast.success(t("settings.saved"));
  }

  return (
    <div className="space-y-5">
      <section className="bg-card/80 rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">
            {t("settings.profile.title")}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("settings.profile.description")}
          </p>
        </div>
        <div className="p-4">
          <ProfilePhotoControl userName={userName} userEmail={userEmail} />
        </div>
      </section>

      <section className="bg-card/80 rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">
            {t("settings.preferences.title")}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("settings.preferences.description")}
          </p>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="organization-name">
              {t("settings.organizationName")}
            </Label>
            <Input
              id="organization-name"
              value={preferences.organizationName}
              onChange={(event) =>
                updatePreference("organizationName", event.target.value)
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="default-language">
              {t("settings.defaultLanguage")}
            </Label>
            <LanguageSelector id="default-language" triggerClassName="w-full" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="appearance-mode">{t("settings.appearance")}</Label>
            <Select
              value={isMounted ? (theme ?? "light") : "light"}
              onValueChange={setTheme}
            >
              <SelectTrigger id="appearance-mode" className="w-full">
                <SelectValue
                  placeholder={t("settings.appearancePlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  {t("settings.appearance.light")}
                </SelectItem>
                <SelectItem value="dark">
                  {t("settings.appearance.dark")}
                </SelectItem>
                <SelectItem value="system">
                  {t("settings.appearance.system")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label
            htmlFor="ask-expected-close-date"
            className="bg-secondary/30 flex items-start gap-3 rounded-md border p-3 md:col-span-2"
          >
            <input
              id="ask-expected-close-date"
              type="checkbox"
              className="accent-primary mt-1 size-4"
              checked={preferences.askExpectedCloseDate}
              onChange={(event) =>
                updatePreference("askExpectedCloseDate", event.target.checked)
              }
            />
            <span>
              <span className="block text-sm font-medium">
                {t("settings.askCloseDate")}
              </span>
              <span className="text-muted-foreground mt-1 block text-sm leading-5">
                {t("settings.askCloseDateDescription")}
              </span>
            </span>
          </label>
        </div>
        <div className="flex justify-end border-t p-4">
          <Button type="button" onClick={savePreferences}>
            {t("common.actions.save")}
          </Button>
        </div>
      </section>
    </div>
  );
}
