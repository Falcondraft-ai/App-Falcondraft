import { isLanguage, type Language } from "@/lib/i18n/translations";

export const UI_LANGUAGE_STORAGE_KEY = "falcondraft:ui-language";

export function readStoredLanguage(): Language {
  if (typeof window === "undefined") {
    return "fr";
  }

  const storedLanguage = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);

  return isLanguage(storedLanguage) ? storedLanguage : "fr";
}

export function writeStoredLanguage(language: Language) {
  window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
}
