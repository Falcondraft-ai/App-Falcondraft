import Link from "next/link";
import { ActivityLog } from "@/components/common/activity-log";
import { DashboardStatCard } from "@/components/common/dashboard-stat-card";
import { DealStatusBadge } from "@/components/common/deal-status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { WorkflowTimeline } from "@/components/common/workflow-timeline";
import { DashboardActivityChart } from "@/components/dashboard/dashboard-activity-chart";
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
import { formatCurrency, formatDate } from "@/lib/format";

export default async function DashboardPage() {
  const context = await requireCurrentUserContext();
  const dashboard = await getDashboardData(context.organization?.id ?? null, {
    userId: context.user.id,
    role: context.membership?.role,
    allowMemberCompanyVisibility:
      context.organization?.allow_member_company_visibility ?? true,
    scope: "mine",
  });

  return (
    <PageTransition>
      <div className="space-y-5">
        <PageHeader
          eyebrow={<T tx="dashboard.eyebrow" />}
          title={`Bonjour, ${(context.profile?.full_name ?? context.user.email ?? "").split(" ").at(0) ?? ""}`}
          description={<T tx="dashboard.description" />}
          actions={
            <Button asChild>
              <Link href="/dashboard/deals/new">
                <T tx="common.actions.createDeal" />
              </Link>
            </Button>
          }
        />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            label={<T tx="dashboard.stats.activeDeals" />}
            value={String(dashboard.activeDeals.length)}
            detail={<T tx="dashboard.stats.activeDealsDetail" />}
            tone="accent"
          />
          <DashboardStatCard
            label={<T tx="dashboard.stats.readyDocuments" />}
            value={String(dashboard.readyDocumentCount)}
            detail={<T tx="dashboard.stats.readyDocumentsDetail" />}
            tone="success"
          />
          <DashboardStatCard
            label={<T tx="dashboard.stats.pipelineValue" />}
            value={formatCurrency(dashboard.pipelineValue)}
            detail={<T tx="dashboard.stats.pipelineValueDetail" />}
          />
          <DashboardStatCard
            label={<T tx="dashboard.stats.attention" />}
            value={String(dashboard.attentionCount)}
            detail={<T tx="dashboard.stats.attentionDetail" />}
          />
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
          <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background-card)] shadow-sm">
            <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">
                  <T tx="dashboard.recentDeals.title" />
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  <T tx="dashboard.recentDeals.description" />
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/dashboard/deals">
                  <T tx="common.actions.viewAll" />
                </Link>
              </Button>
            </div>
            {dashboard.deals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                      <T tx="table.deal" />
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                      <T tx="table.status" />
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                      <T tx="table.budget" />
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                      <T tx="table.updated" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.deals.slice(0, 5).map((deal) => (
                    <TableRow
                      key={deal.id}
                      className="duration-100 hover:bg-[var(--background-subtle)]"
                    >
                      <TableCell>
                        <Link
                          href={`/dashboard/deals/${deal.id}`}
                          className="hover:text-primary font-medium transition-colors"
                        >
                          {deal.name}
                        </Link>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {deal.clientCompanyName}
                        </p>
                      </TableCell>
                      <TableCell>
                        <DealStatusBadge status={deal.status} />
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatCurrency(deal.amountEstimate)}
                      </TableCell>
                      <TableCell>{formatDate(deal.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-4">
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

          <section className="rounded-lg border border-[var(--border)] bg-[var(--background-card)] shadow-sm">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">
                <T tx="dashboard.featured.title" />
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                <T tx="dashboard.featured.description" />
              </p>
            </div>
            <div className="p-4">
              {dashboard.featuredDeal ? (
                <>
                  <div className="mb-4">
                    <p className="text-sm font-medium">
                      {dashboard.featuredDeal.name}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {dashboard.featuredDeal.clientCompanyName}
                    </p>
                  </div>
                  <WorkflowTimeline
                    status={dashboard.featuredDeal.status}
                    compact
                  />
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  <T tx="dashboard.featured.empty" />
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--background-card)] shadow-sm">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">
                <T tx="dashboard.chart.title" />
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                <T tx="dashboard.chart.description" />
              </p>
            </div>
            <div className="p-4">
              <DashboardActivityChart data={dashboard.chartData} />
            </div>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--background-card)] shadow-sm">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">
                <T tx="dashboard.activity.title" />
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                <T tx="dashboard.activity.description" />
              </p>
            </div>
            <div className="p-4">
              <ActivityLog items={dashboard.activity} />
            </div>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
