import { HardDrive } from "lucide-react";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import {
  computeStorageUsage,
  formatBytes,
  STORAGE_CRITICAL_THRESHOLD,
  STORAGE_WARNING_THRESHOLD,
} from "@/lib/broker/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CourtierStorageSettingsPage() {
  const context = await requireActiveWorkspaceContext();
  const usage = computeStorageUsage(context.organization);

  const barColor =
    usage.level === "full" || usage.level === "critical"
      ? "var(--destructive)"
      : usage.level === "warning"
        ? "var(--warning)"
        : "var(--accent)";

  return (
    <section
      className="rounded-lg border bg-[var(--bg-surface)] p-5 sm:p-6"
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center gap-2">
        <HardDrive
          className="size-4 text-[var(--brand-navy-700)]"
          strokeWidth={1.75}
        />
        <h2 className="text-[14px] font-semibold text-[var(--fg-1)]">
          Espace de stockage
        </h2>
      </div>
      <p className="mt-1 text-[12.5px] leading-5 text-[var(--fg-3)]">
        Stockage utilisé par l’ensemble des documents de vos dossiers clients.
      </p>

      <div className="mt-5 flex items-baseline justify-between">
        <span className="fd-numeric text-[28px] font-semibold leading-none tracking-[-0.015em] text-[var(--fg-1)]">
          {formatBytes(usage.usedBytes)}
        </span>
        <span className="text-[13px] text-[var(--fg-3)]">
          sur {formatBytes(usage.limitBytes)} ({usage.percent}%)
        </span>
      </div>

      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--brand-navy-50)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${Math.max(2, usage.percent)}%`, background: barColor }}
        />
      </div>

      {usage.level !== "ok" ? (
        <div
          className="mt-4 rounded-md border px-4 py-3 text-[12.5px] leading-5"
          style={{
            borderColor:
              usage.level === "warning"
                ? "var(--brand-amber-200)"
                : "var(--status-error-bd)",
            background:
              usage.level === "warning"
                ? "var(--brand-amber-50)"
                : "var(--status-error-bg)",
            color:
              usage.level === "warning"
                ? "var(--brand-amber-800)"
                : "var(--status-error-fg)",
          }}
        >
          {usage.level === "full"
            ? "Quota atteint. Les nouveaux imports sont bloqués tant que de l’espace n’est pas libéré. Contactez le support pour augmenter votre limite."
            : usage.level === "critical"
              ? `Vous avez dépassé ${Math.round(STORAGE_CRITICAL_THRESHOLD * 100)}% de votre quota. Pensez à archiver les dossiers terminés.`
              : `Vous avez dépassé ${Math.round(STORAGE_WARNING_THRESHOLD * 100)}% de votre quota de stockage.`}
        </div>
      ) : (
        <p className="mt-4 text-[12.5px] leading-5 text-[var(--fg-3)]">
          Vous serez alerté lorsque vous approcherez de votre limite.
        </p>
      )}
    </section>
  );
}
