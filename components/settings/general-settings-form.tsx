"use client";

import { useTheme } from "next-themes";
import * as React from "react";
import { toast } from "sonner";
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
  defaultLanguage: string;
  displayDensity: string;
};

function getDefaultPreferences(
  organizationName: string,
  defaultLanguage: string,
): SettingsPreferences {
  return {
    organizationName,
    defaultLanguage,
    displayDensity: "comfortable",
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
        Object.entries(parsedValue).filter(
          ([key, value]) =>
            key in fallback && typeof value === "string",
        ),
      ),
    };
  } catch {
    return fallback;
  }
}

export function GeneralSettingsForm({
  organizationName,
  defaultLanguage,
  userName,
  userEmail,
}: {
  organizationName: string;
  defaultLanguage: string;
  userName: string;
  userEmail: string;
}) {
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = React.useState(false);
  const fallbackPreferences = React.useMemo(
    () => getDefaultPreferences(organizationName, defaultLanguage),
    [defaultLanguage, organizationName],
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
    toast.success("Paramètres enregistrés.");
  }

  return (
    <div className="space-y-5">
      <section className="border bg-card/80">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Profil</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Photo et identité affichées dans votre espace client.
          </p>
        </div>
        <div className="p-4">
          <ProfilePhotoControl userName={userName} userEmail={userEmail} />
        </div>
      </section>

      <section className="border bg-card/80">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Préférences</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Réglages utiles pour adapter l’espace à votre usage quotidien.
          </p>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="organization-name">Nom de l’organisation</Label>
            <Input
              id="organization-name"
              value={preferences.organizationName}
              onChange={(event) =>
                updatePreference("organizationName", event.target.value)
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="default-language">Langue par défaut</Label>
            <Select
              value={preferences.defaultLanguage}
              onValueChange={(value) =>
                updatePreference("defaultLanguage", value)
              }
            >
              <SelectTrigger id="default-language" className="w-full">
                <SelectValue placeholder="Sélectionner une langue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Français">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="appearance-mode">Mode d’affichage</Label>
            <Select
              value={isMounted ? (theme ?? "light") : "light"}
              onValueChange={setTheme}
            >
              <SelectTrigger id="appearance-mode" className="w-full">
                <SelectValue placeholder="Choisir un thème" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Clair</SelectItem>
                <SelectItem value="dark">Sombre</SelectItem>
                <SelectItem value="system">Système</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="display-density">Densité d’affichage</Label>
            <Select
              value={preferences.displayDensity}
              onValueChange={(value) => updatePreference("displayDensity", value)}
            >
              <SelectTrigger id="display-density" className="w-full">
                <SelectValue placeholder="Choisir une densité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">Confortable</SelectItem>
                <SelectItem value="compact">Plus compacte</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end border-t p-4">
          <Button type="button" onClick={savePreferences}>
            Enregistrer
          </Button>
        </div>
      </section>
    </div>
  );
}
