import type { OrganizationRow } from "@/types/database";

export const DEFAULT_STORAGE_LIMIT_BYTES = 268435456000; // 250 GB
export const STORAGE_WARNING_THRESHOLD = 0.8; // 80 %
export const STORAGE_CRITICAL_THRESHOLD = 0.95; // 95 %

export type StorageUsageLevel = "ok" | "warning" | "critical" | "full";

export type StorageUsage = {
  usedBytes: number;
  limitBytes: number;
  ratio: number; // 0..1, clamped
  percent: number; // 0..100, rounded
  level: StorageUsageLevel;
  isFull: boolean;
};

export function computeStorageUsage(
  organization: Pick<
    OrganizationRow,
    "storage_used_bytes" | "storage_limit_bytes"
  > | null,
): StorageUsage {
  const usedBytes = Math.max(0, organization?.storage_used_bytes ?? 0);
  const limitBytes = Math.max(
    1,
    organization?.storage_limit_bytes ?? DEFAULT_STORAGE_LIMIT_BYTES,
  );
  const ratio = Math.min(usedBytes / limitBytes, 1);
  const percent = Math.round(ratio * 100);

  let level: StorageUsageLevel = "ok";
  if (usedBytes >= limitBytes) {
    level = "full";
  } else if (ratio >= STORAGE_CRITICAL_THRESHOLD) {
    level = "critical";
  } else if (ratio >= STORAGE_WARNING_THRESHOLD) {
    level = "warning";
  }

  return {
    usedBytes,
    limitBytes,
    ratio,
    percent,
    level,
    isFull: usedBytes >= limitBytes,
  };
}

/** Whether a new upload of `incomingBytes` would fit within the quota. */
export function canUploadWithinQuota(
  usage: Pick<StorageUsage, "usedBytes" | "limitBytes">,
  incomingBytes: number,
): boolean {
  return usage.usedBytes + Math.max(0, incomingBytes) <= usage.limitBytes;
}

const UNITS = ["o", "Ko", "Mo", "Go", "To"] as const;

/** Human-readable byte size in French units (o, Ko, Mo, Go, To). */
export function formatBytes(bytes: number, fractionDigits = 1): string {
  const value = Math.max(0, bytes);
  if (value < 1) return "0 o";
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    UNITS.length - 1,
  );
  const scaled = value / 1024 ** exponent;
  const digits = exponent === 0 ? 0 : fractionDigits;
  return `${scaled.toFixed(digits).replace(".", ",")} ${UNITS[exponent]}`;
}
