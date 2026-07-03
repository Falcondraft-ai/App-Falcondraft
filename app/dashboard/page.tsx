import Link from "next/link";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import {
  DashboardStatCard,
  StatStrip,
} from "@/components/common/dashboard-stat-card";
import { DealStatusBadge } from "@/components/common/deal-status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { DashboardActivityChart } from "@/components/dashboard/dashboard-activity-chart";
import { DashboardAutoRefresh } from "@/components/dashboard/dashboard-auto-refresh";
import { FollowUpPanel } from "@/components/dashboard/follow-up-panel";
import { PipelineStagePanel } from "@/components/dashboard/pipeline-stage-panel";
import { T } from "@/components/i18n/translated-text";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/data/supabase-app-data";
import { formatCurrency, formatDate, formatLongDate } from "@/lib/format";
import type { Deal, DealStatus } from "@/types/deal";

type StageKey = "draft" | "review" | "sent" | "signed";

const statusFamily: Record<DealStatus, StageKey | "archived"> = {
  draft: "draft",
  call_summary_ready: "draft",
  proposal_generating: "draft",
  proposal_ready: "review",
  validation_pending: "review",
  final_document_generating: "review",
  final_document_ready: "sent",
  signature_ready: "sent",
  email_draft_ready: "sent",
  completed: "signed",
  failed: "archived",
};

function aggregateStages(deals: Deal[]): {
  key: StageKey;
  count: number;
  amount: number;
}[] {
  const buckets: Record<StageKey, { count: number; amount: number }> = {
    draft: { count: 0, amount: 0 },
    review: { count: 0, amount: 0 },
    sent: { count: 0, amount: 0 },
    signed: { count: 0, amount: 0 },
  };
  for (const deal of deals) {
    const family = statusFamily[deal.status];
    if (family === "archived") continue;
    buckets[family].count += 1;
    buckets[family].amount += deal.amountEstimate ?? 0;
  }
  return (["draft", "review", "sent", "signed"] as StageKey[]).map((key) => ({
    key,
    count: buckets[key].count,
    amount: buckets[key].amount,
  }));
}

export default async function DashboardPage() {
  const context = await requireCurrentUserContext();
  const dashboard = await getDashboardData(context.organization?.id ?? null, {
    userId: context.user.id,
    role: context.membership?.role,
    allowMemberCompanyVisibility:
      context.organization?.allow_member_company_visibility ?? true,
    scope: "mine",
  });

  const firstName =
    (context.profile?.full_name ?? context.user.email ?? "").split(" ").at(0) ??
    "";

  const stages = aggregateStages(dashboard.deals);

  const signedCount = dashboard.deals.filter(
    (deal) => deal.status === "completed",
  ).length;
  const consideredForRate = dashboard.deals.filter(
    (deal) => deal.status !== "draft" && deal.status !== "call_summary_ready",
  ).length;
  const signatureRate =
    consideredForRate === 0
      ? null
      : Math.round((signedCount / consideredForRate) * 100);

  // Prioritise deals that explicitly need action; fall back to any active
  // deal (drafts included) so the panel is never empty when work is open.
  const followUpPriority: Record<string, number> = {
    failed: 0,
    validation_pending: 1,
    signature_ready: 2,
    email_draft_ready: 3,
    proposal_ready: 4,
    final_document_ready: 5,
    proposal_generating: 6,
    final_document_generating: 6,
    call_summary_ready: 7,
    draft: 8,
  };
  const followUpDeals = [...dashboard.activeDeals]
    .sort((a, b) => {
      const pa = followUpPriority[a.status] ?? 99;
      const pb = followUpPriority[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return (
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    })
    .slice(0, 4);

  const today = formatLongDate(new Date());

  return (
    <PageTransition>
      <DashboardAutoRefresh />
      <div className="space-y-6">
        <PageHeader
          size="large"
          eyebrow={
            <span className="capitalize">{today}</span>
          }
          title={firstName ? `Bonjour ${firstName}` : "Bonjour"}
          description={
            <>
              {dashboard.attentionCount > 0
                ? `${dashboard.attentionCount} proposition${dashboard.attentionCount > 1 ? "s" : ""} à finaliser aujourd'hui.`
                : "Tous vos dossiers sont à jour."}
            </>
          }
          actions={
            <Button asChild>
              <Link
                href="/dashboard/deals/new"
                className="inline-flex items-center gap-1.5"
              >
                <Plus className="size-3.5" strokeWidth={2.25} />
                <T tx="common.actions.createDeal" />
              </Link>
            </Button>
          }
        />

        <StatStrip className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            variant="cell"
            label={<T tx="dashboard.stats.pipelineOpen" />}
            value={formatCurrency(dashboard.pipelineValue)}
            detail={
              <T tx="dashboard.stats.pipelineValueDetail" />
            }
            tone="accent"
          />
          <DashboardStatCard
            variant="cell"
            label={<T tx="dashboard.stats.activeProposals" />}
            value={String(dashboard.activeDeals.length)}
            detail={<T tx="dashboard.stats.activeDealsDetail" />}
          />
          <DashboardStatCard
            variant="cell"
            label={<T tx="dashboard.stats.signatureRate" />}
            value={signatureRate === null ? "—" : `${signatureRate} %`}
            detail={<T tx="dashboard.stats.signatureRateDetail" />}
          />
          <DashboardStatCard
            variant="cell"
            label={<T tx="dashboard.stats.readyToSend" />}
            value={String(dashboard.readyDocumentCount)}
            detail={<T tx="dashboard.stats.readyDocumentsDetail" />}
            tone="success"
          />
        </StatStrip>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <PipelineStagePanel stages={stages} />
          <FollowUpPanel deals={followUpDeals} />
        </div>

        <section
          className="overflow-hidden rounded-lg border bg-[var(--bg-surface)]"
          style={{
            borderColor: "var(--border-1)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4"
            style={{ borderColor: "var(--border-1)" }}
          >
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold leading-tight tracking-[-0.005em] text-[var(--fg-1)] sm:text-[15px]">
                <T tx="dashboard.recentDeals.title" />
              </h2>
              <p className="mt-1 text-[12px] leading-5 text-[var(--fg-3)] sm:text-[12.5px]">
                <T tx="dashboard.recentDeals.description" />
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/deals">
                <T tx="common.actions.viewAll" />
              </Link>
            </Button>
          </div>
          {dashboard.deals.length > 0 ? (
            <div className="-mx-px overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow
                  className="hover:bg-transparent"
                  style={{
                    background: "var(--bg-sunken)",
                  }}
                >
                  <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                    <T tx="table.deal" />
                  </TableHead>
                  <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                    <T tx="table.status" />
                  </TableHead>
                  <TableHead className="h-10 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                    <T tx="table.budget" />
                  </TableHead>
                  <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                    <T tx="table.updated" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.deals.slice(0, 5).map((deal) => (
                  <TableRow
                    key={deal.id}
                    className="duration-100 hover:bg-[rgba(14,34,56,0.025)]"
                  >
                    <TableCell>
                      <Link
                        href={`/dashboard/deals/${deal.id}`}
                        className="text-[13px] font-semibold text-[var(--fg-1)] transition-colors hover:text-[var(--brand-navy-800)]"
                      >
                        {deal.clientCompanyName || deal.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11.5px] text-[var(--fg-3)]">
                        {deal.name}
                      </p>
                    </TableCell>
                    <TableCell>
                      <DealStatusBadge status={deal.status} />
                    </TableCell>
                    <TableCell className="fd-numeric text-right text-[13px] font-semibold text-[var(--fg-1)]">
                      {formatCurrency(deal.amountEstimate)}
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-[var(--fg-3)]">
                      {formatDate(deal.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title={<T tx="common.empty.deals.title" />}
                description={<T tx="common.empty.deals.description" />}
                action={
                  <Button asChild>
                    <Link href="/dashboard/deals/new">
                      <T tx="common.actions.createDeal" />
                    </Link>
                  </Button>
                }
              />
            </div>
          )}
        </section>

        <section
          className="overflow-hidden rounded-lg border bg-[var(--bg-surface)]"
          style={{
            borderColor: "var(--border-1)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4"
            style={{ borderColor: "var(--border-1)" }}
          >
            <div className="min-w-0">
              <p className="fd-eyebrow">Activité</p>
              <h2 className="mt-1 text-[14px] font-semibold leading-tight tracking-[-0.005em] text-[var(--fg-1)] sm:text-[15px]">
                <T tx="dashboard.chart.title" />
              </h2>
              <p className="mt-1 text-[12px] leading-5 text-[var(--fg-3)] sm:text-[12.5px]">
                <T tx="dashboard.chart.description" />
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ChartLegend />
            </div>
          </div>
          <div className="p-3 sm:p-5">
            <DashboardActivityChart data={dashboard.chartData} />
          </div>
        </section>
      </div>
    </PageTransition>
  );
}

function ChartLegend() {
  return (
    <div className="flex items-center gap-3 text-[11px] font-medium text-[var(--fg-3)]">
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--brand-navy-800)" }}
        />
        Propositions
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--accent)" }}
        />
        Documents
      </span>
    </div>
  );
}
