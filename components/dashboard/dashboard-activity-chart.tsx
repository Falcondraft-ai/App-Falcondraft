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
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
        >
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--card)",
              color: "var(--card-foreground)",
              boxShadow: "none",
            }}
          />
          <Area
            type="monotone"
            dataKey="propositions"
            stroke="var(--primary)"
            fill="var(--primary)"
            fillOpacity={0.12}
            strokeWidth={2}
            name={t("documentType.proposal")}
          />
          <Area
            type="monotone"
            dataKey="documents"
            stroke="var(--chart-1)"
            fill="var(--chart-1)"
            fillOpacity={0.12}
            strokeWidth={2}
            name={t("nav.documents")}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
