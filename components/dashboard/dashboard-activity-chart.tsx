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
import type { dashboardChartData } from "@/data/mock-deals";
import { useMounted } from "@/hooks/use-mounted";

type ChartData = typeof dashboardChartData;

export function DashboardActivityChart({ data }: { data: ChartData }) {
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div
        className="bg-muted/40 h-64 w-full rounded-md border"
        aria-label="Chargement du graphique d’activité"
      />
    );
  }

  return (
    <div className="h-64 w-full">
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
            name="Propositions"
          />
          <Area
            type="monotone"
            dataKey="documents"
            stroke="var(--chart-1)"
            fill="var(--chart-1)"
            fillOpacity={0.12}
            strokeWidth={2}
            name="Documents"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
