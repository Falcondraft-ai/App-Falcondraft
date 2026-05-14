"use client";

import { useI18n } from "@/components/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/translations";

export function T({
  tx,
  params,
}: {
  tx: TranslationKey;
  params?: Record<string, string | number>;
}) {
  const { t } = useI18n();

  return <>{t(tx, params)}</>;
}
