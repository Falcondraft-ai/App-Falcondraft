import Link from "next/link";
import { ActivityLog } from "@/components/common/activity-log";
import { DashboardStatCard } from "@/components/common/dashboard-stat-card";
import { DealStatusBadge } from "@/components/common/deal-status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { WorkflowTimeline } from "@/components/common/workflow-timeline";
import { DashboardActivityChart } from "@/components/dashboard/dashboard-activity-chart";
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
    scope: "organization",
  });

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Tableau de bord"
          title="Suivi commercial"
          description="Vue de travail pour suivre les dossiers commerciaux, les documents et les étapes de validation."
          actions={
            <Button asChild>
              <Link href="/dashboard/deals/new">
                Créer un dossier commercial
              </Link>
            </Button>
          }
        />

        <section className="grid gap-3 md:grid-cols-4">
          <DashboardStatCard
            label="Dossiers actifs"
            value={String(dashboard.activeDeals.length)}
            detail="Hors dossiers terminés"
            tone="accent"
          />
          <DashboardStatCard
            label="Documents prêts"
            value={String(dashboard.readyDocumentCount)}
            detail="À valider ou envoyer"
            tone="success"
          />
          <DashboardStatCard
            label="Valeur estimée"
            value={formatCurrency(dashboard.pipelineValue)}
            detail="Pipeline en cours"
          />
          <DashboardStatCard
            label="À traiter"
            value={String(dashboard.attentionCount)}
            detail="Validation, document ou erreur"
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="bg-card/75 rounded-lg border">
            <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Dossiers récents</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Dossiers qui demandent une attention commerciale.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/dashboard/deals">Tout voir</Link>
              </Button>
            </div>
            {dashboard.deals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dossier commercial</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Mise à jour</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.deals.slice(0, 5).map((deal) => (
                    <TableRow key={deal.id}>
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
                  title="Aucun dossier commercial"
                  description="Créez un premier dossier commercial pour suivre le pipeline et les documents associés."
                  action={
                    <Button asChild>
                      <Link href="/dashboard/deals/new">
                        Créer un dossier commercial
                      </Link>
                    </Button>
                  }
                />
              </div>
            )}
          </section>

          <section className="bg-card/75 rounded-lg border">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Dossier à suivre</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Prochaine avancée commerciale à surveiller.
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
                  Aucun dossier prioritaire pour le moment.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="bg-card/75 rounded-lg border">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Activité de génération</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Volume mensuel des propositions et documents finaux.
              </p>
            </div>
            <div className="p-4">
              <DashboardActivityChart data={dashboard.chartData} />
            </div>
          </section>

          <section className="bg-card/75 rounded-lg border">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Journal récent</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Derniers changements significatifs.
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
