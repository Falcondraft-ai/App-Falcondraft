"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/components/i18n/language-provider";
import { useMounted } from "@/hooks/use-mounted";

export type DashboardChartDatum = {
  month: string;
  propositions: number;
  documents: number;
};

export function DashboardActivityChart({
  data,
}: {
  data: DashboardChartDatum[];
}) {
  const mounted = useMounted();
  const { t } = useI18n();

  if (!mounted) {
    return (
      <div
        className="bg-muted/40 h-56 w-full rounded-md border"
        aria-label={t("dashboard.chart.title")}
      />
    );
  }

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 8, left: -18, bottom: 0 }}
        >
          <defs>
            <linearGradient id="fd-prop-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand-navy-800)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--brand-navy-800)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fd-doc-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--border-1)"
            strokeDasharray="2 4"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--fg-3)", fontSize: 11 }}
            dy={4}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--fg-3)", fontSize: 11 }}
            width={28}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-2)", strokeDasharray: "2 2" }}
            contentStyle={{
              border: "1px solid var(--border-1)",
              borderRadius: 8,
              background: "#FFFFFF",
              color: "var(--fg-1)",
              boxShadow: "var(--shadow-md)",
              fontSize: 12,
              padding: "8px 10px",
            }}
            labelStyle={{
              color: "var(--fg-3)",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          />
          <Area
            type="monotone"
            dataKey="propositions"
            stroke="var(--brand-navy-800)"
            fill="url(#fd-prop-gradient)"
            strokeWidth={2}
            name={t("documentType.proposal")}
          />
          <Area
            type="monotone"
            dataKey="documents"
            stroke="var(--accent)"
            fill="url(#fd-doc-gradient)"
            strokeWidth={2}
            name={t("nav.documents")}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
