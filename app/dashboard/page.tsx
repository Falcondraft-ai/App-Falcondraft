import Link from "next/link";
import { ActivityLog } from "@/components/common/activity-log";
import { DashboardStatCard } from "@/components/common/dashboard-stat-card";
import { DealStatusBadge } from "@/components/common/deal-status-badge";
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
import { mockActivity } from "@/data/mock-activity";
import { dashboardChartData, mockDeals } from "@/data/mock-deals";
import { formatCurrency, formatDate } from "@/lib/format";

const activeDeals = mockDeals.filter((deal) => deal.status !== "completed");
const readyDeals = mockDeals.filter((deal) =>
  ["proposal_ready", "final_document_ready", "signature_ready"].includes(
    deal.status,
  ),
);
const pipelineValue = activeDeals.reduce(
  (total, deal) => total + deal.amountEstimate,
  0,
);

export default function DashboardPage() {
  const featuredDeal = mockDeals[0];

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Tableau de bord"
          title="Pilotage des propositions"
          description="Vue de travail pour suivre les opportunités, les documents et les étapes de validation."
          actions={
            <Button asChild>
              <Link href="/dashboard/deals/new">Créer une opportunité</Link>
            </Button>
          }
        />

        <section className="grid gap-3 md:grid-cols-4">
          <DashboardStatCard
            label="Opportunités actives"
            value={String(activeDeals.length)}
            detail="Hors dossiers terminés"
            tone="accent"
          />
          <DashboardStatCard
            label="Documents prêts"
            value={String(readyDeals.length)}
            detail="À valider ou envoyer"
            tone="success"
          />
          <DashboardStatCard
            label="Valeur estimée"
            value={formatCurrency(pipelineValue)}
            detail="Pipeline en cours"
          />
          <DashboardStatCard
            label="Cycle moyen"
            value="9,4 j"
            detail="Création à document final"
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="border bg-card/75">
            <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">
                  Opportunités récentes
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Dossiers qui demandent une attention commerciale.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/dashboard/deals">Tout voir</Link>
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Échéance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockDeals.slice(0, 5).map((deal) => (
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
                    <TableCell>{formatDate(deal.expectedCloseDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section className="border bg-card/75">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Statut du flux</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Progression du dossier prioritaire.
              </p>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm font-medium">{featuredDeal.name}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {featuredDeal.clientCompanyName}
                </p>
              </div>
              <WorkflowTimeline status={featuredDeal.status} compact />
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="border bg-card/75">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Activité de génération</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Volume mensuel des propositions et documents finaux.
              </p>
            </div>
            <div className="p-4">
              <DashboardActivityChart data={dashboardChartData} />
            </div>
          </section>

          <section className="border bg-card/75">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Journal récent</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Derniers changements significatifs.
              </p>
            </div>
            <div className="p-4">
              <ActivityLog items={mockActivity.slice(0, 4)} />
            </div>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
