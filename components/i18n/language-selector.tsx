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
            {t(availableLanguage === "fr" ? "language.fr" : "language.en")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
