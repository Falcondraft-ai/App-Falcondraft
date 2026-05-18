"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n/language-provider";
import { languages, type Language } from "@/lib/i18n/translations";

const languageLabels: Record<
  Language,
  { flag: string; tx: "language.fr" | "language.en" | "language.es" }
> = {
  fr: { flag: "🇫🇷", tx: "language.fr" },
  en: { flag: "🇬🇧", tx: "language.en" },
  es: { flag: "🇪🇸", tx: "language.es" },
};

export function LanguageSelector({
  id,
  triggerClassName,
}: {
  id?: string;
  triggerClassName?: string;
}) {
  const { language, setLanguage, t } = useI18n();

  return (
    <Select
      value={language}
      onValueChange={(value) => setLanguage(value as Language)}
    >
      <SelectTrigger
        id={id}
        className={triggerClassName}
        aria-label={t("language.label")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languages.map((availableLanguage) => (
          <SelectItem key={availableLanguage} value={availableLanguage}>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true">
                {languageLabels[availableLanguage].flag}
              </span>
              <span>{t(languageLabels[availableLanguage].tx)}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
