"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import type { ProspectCompanyRow } from "@/types/database";

const CLOSERS = ["Timéo", "Enzo", "Margot"] as const;

interface KpiCardProps {
  label: string;
  value: number;
  colorClass: string;
}

function KpiCard({ label, value, colorClass }: KpiCardProps) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${colorClass}`}>
        {value}
      </p>
    </div>
  );
}

function CloserRow({
  closer,
  companies,
}: {
  closer: string;
  companies: ProspectCompanyRow[];
}) {
  const assigned = companies.filter((c) => c.assigned_closer === closer);
  const total = assigned.length;
  const called = assigned.filter((c) => c.status === "called").length;
  const meetings = assigned.filter((c) => c.status === "meeting_booked").length;
  const clients = assigned.filter((c) => c.status === "client").length;

  return (
    <div className="flex items-center gap-4 py-2.5 px-4 border-b last:border-0">
      <span className="text-sm font-medium w-20 shrink-0">{closer}</span>
      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-1">
        <span className="w-16 text-right">{total} leads</span>
        <span className="w-16 text-right">{called} appelés</span>
        <span className="w-16 text-right">{meetings} RDV</span>
        <span className="w-16 text-right">{clients} clients</span>
      </div>
    </div>
  );
}

export function DashboardTab({
  companies,
}: {
  companies: ProspectCompanyRow[];
}) {
  const total = companies.length;
  const toCall = companies.filter((c) => c.status === "to_call").length;
  const called = companies.filter((c) => c.status === "called").length;
  const meetings = companies.filter((c) => c.status === "meeting_booked").length;
  const clients = companies.filter((c) => c.status === "client").length;
  const badFit = companies.filter(
    (c) => c.status === "bad_fit" || c.status === "not_interested",
  ).length;
  const archived = companies.filter((c) => c.status === "archived").length;

  const scoredCompanies = companies.filter(
    (c) => c.fit_score != null,
  );
  const avgScore =
    scoredCompanies.length > 0
      ? Math.round(
          scoredCompanies.reduce((sum, c) => sum + (c.fit_score ?? 0), 0) /
            scoredCompanies.length,
        )
      : null;

  const highPriority = companies.filter((c) => c.priority === "high").length;
  const mediumPriority = companies.filter((c) => c.priority === "medium").length;
  const lowPriority = companies.filter((c) => c.priority === "low").length;
  const unscored = companies.filter((c) => c.fit_score == null).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Vue d&apos;ensemble
        </h2>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <KpiCard
            label="Total leads"
            value={total}
            colorClass="text-foreground"
          />
          <KpiCard
            label="À appeler"
            value={toCall}
            colorClass="text-amber-600 dark:text-amber-400"
          />
          <KpiCard
            label="Appelés"
            value={called}
            colorClass="text-emerald-600 dark:text-emerald-400"
          />
          <KpiCard
            label="RDV pris"
            value={meetings}
            colorClass="text-violet-600 dark:text-violet-400"
          />
          <KpiCard
            label="Clients"
            value={clients}
            colorClass="text-teal-600 dark:text-teal-400"
          />
          <KpiCard
            label="Mauvais fit"
            value={badFit}
            colorClass="text-red-600 dark:text-red-400"
          />
          <KpiCard
            label="Archivés"
            value={archived}
            colorClass="text-zinc-500"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border rounded-lg overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Performance par closer
            </h3>
          </div>
          <div className="divide-y">
            <div className="flex items-center gap-4 py-2 px-4 bg-muted/20">
              <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">
                Closer
              </span>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-1">
                <span className="w-16 text-right">Total</span>
                <span className="w-16 text-right">Appelés</span>
                <span className="w-16 text-right">RDV</span>
                <span className="w-16 text-right">Clients</span>
              </div>
            </div>
            {CLOSERS.map((closer) => (
              <CloserRow key={closer} closer={closer} companies={companies} />
            ))}
          </div>
        </Card>

        <Card className="border rounded-lg overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Qualité des leads
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {avgScore != null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Score moyen
                </span>
                <span className="text-sm font-semibold">
                  {avgScore}/100
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Priorité haute
              </span>
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                {highPriority}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Priorité moyenne
              </span>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {mediumPriority}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Priorité basse
              </span>
              <span className="text-sm font-semibold text-slate-500">
                {lowPriority}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Non scorés
              </span>
              <span className="text-sm font-semibold text-muted-foreground">
                {unscored}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
