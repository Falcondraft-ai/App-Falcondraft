"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";
import { formatCurrency } from "@/lib/format";

type StageKey = "draft" | "review" | "sent" | "signed";

type StageInput = {
  key: StageKey;
  count: number;
  amount: number;
};

const stageTone: Record<StageKey, string> = {
  draft: "var(--brand-amber-500)",
  review: "var(--status-review-fg)",
  sent: "var(--status-sent-fg)",
  signed: "var(--status-signed-fg)",
};

export function PipelineStagePanel({ stages }: { stages: StageInput[] }) {
  const { t } = useI18n();
  const [range, setRange] = React.useState<"week" | "month" | "quarter">(
    "month",
  );

  const totalAmount = stages.reduce((sum, stage) => sum + stage.amount, 0);
  const totalCount = stages.reduce((sum, stage) => sum + stage.count, 0);
  const maxAmount = Math.max(1, ...stages.map((stage) => stage.amount));

  const ranges: { value: typeof range; label: string }[] = [
    { value: "week", label: t("dashboard.pipeline.range.week") },
    { value: "month", label: t("dashboard.pipeline.range.month") },
    { value: "quarter", label: t("dashboard.pipeline.range.quarter") },
  ];

  return (
    <section
      className="rounded-lg border bg-[var(--bg-surface)] p-4 sm:p-5"
      style={{
        borderColor: "var(--border-1)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.005em] text-[var(--fg-1)]">
          {t("dashboard.pipeline.title")}
        </h2>
        <div
          className="inline-flex items-center gap-[2px] rounded-[7px] border p-[3px]"
          style={{
            background: "var(--bg-sunken)",
            borderColor: "var(--border-1)",
          }}
          role="tablist"
          aria-label={t("dashboard.pipeline.title")}
        >
          {ranges.map((option) => {
            const on = option.value === range;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                aria-pressed={on}
                className="rounded-[5px] px-3 py-[5px] text-[12px] transition-colors"
                style={{
                  background: on ? "#fff" : "transparent",
                  color: on ? "var(--fg-1)" : "var(--fg-2)",
                  fontWeight: on ? 600 : 500,
                  boxShadow: on ? "0 1px 2px rgba(11,18,32,.06)" : "none",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="mt-5 flex flex-col gap-3.5">
        {stages.map((stage) => {
          const share = totalAmount === 0 ? 0 : (stage.amount / maxAmount) * 100;
          const tone = stageTone[stage.key];
          return (
            <div key={stage.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-[7px] w-[7px] rounded-full"
                    style={{ background: tone }}
                  />
                  <span className="text-[12.5px] font-medium text-[var(--fg-2)]">
                    {t(
                      `dashboard.pipeline.stages.${stage.key}` as Parameters<
                        typeof t
                      >[0],
                    )}
                  </span>
                </div>
                <div className="flex items-baseline gap-2.5">
                  <span className="fd-numeric text-[13px] font-semibold text-[var(--fg-1)]">
                    {formatCurrency(stage.amount)}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--fg-3)]">
                    {stage.count} doc.
                  </span>
                </div>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full"
                style={{ background: "var(--bg-sunken)" }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max(2, share)}%`,
                    background: tone,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="mt-5 flex items-center justify-between border-t pt-4"
        style={{ borderColor: "var(--border-1)" }}
      >
        <span className="fd-meta">
          {t("dashboard.pipeline.total")} · {totalCount} propositions
        </span>
        <Link
          href="/dashboard/deals"
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--brand-navy-700)] transition-colors hover:text-[var(--brand-navy-900)]"
        >
          {t("dashboard.pipeline.viewAll")}
          <ArrowRight className="size-3" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
