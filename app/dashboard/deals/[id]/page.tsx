import { notFound } from "next/navigation";
import { ActionCard } from "@/components/common/action-card";
import { ActivityLog } from "@/components/common/activity-log";
import { DealStatusBadge } from "@/components/common/deal-status-badge";
import { PageTransition } from "@/components/common/page-transition";
import { WorkflowTimeline } from "@/components/common/workflow-timeline";
import { DealActionPanel } from "@/components/deals/deal-action-panel";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getDealDetail } from "@/lib/data/supabase-app-data";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

type DealDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { id } = await params;
  const context = await requireCurrentUserContext();
  const { deal, activity } = await getDealDetail(
    context.organization?.id ?? null,
    id,
  );

  if (!deal) {
    notFound();
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <header className="grid gap-4 border-b bg-card/45 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
              Dossier commercial
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {deal.name}
              </h1>
              <DealStatusBadge status={deal.status} />
            </div>
            <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
              {deal.clientCompanyName} · {deal.lastAction}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:text-right">
            <div>
              <p className="text-muted-foreground text-xs">Montant estimé</p>
              <p className="font-mono font-semibold">
                {formatCurrency(deal.amountEstimate)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Créée</p>
              <p>{formatDate(deal.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Mise à jour</p>
              <p>{formatDate(deal.updatedAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Responsable</p>
              <p>{deal.ownerName}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2">
              <ActionCard title="Entreprise cliente">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Organisation</dt>
                    <dd className="mt-1 font-medium">
                      {deal.clientCompanyName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="mt-1">{deal.source}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Échéance visée</dt>
                    <dd className="mt-1">{formatDate(deal.expectedCloseDate)}</dd>
                  </div>
                </dl>
              </ActionCard>

              <ActionCard title="Contact">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Nom</dt>
                    <dd className="mt-1 font-medium">
                      {deal.clientContactName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="mt-1">{deal.clientEmail}</dd>
                  </div>
                  {deal.clientPhone ? (
                    <div>
                      <dt className="text-muted-foreground">Téléphone</dt>
                      <dd className="mt-1">{deal.clientPhone}</dd>
                    </div>
                  ) : null}
                </dl>
              </ActionCard>
            </section>

            <ActionCard
              title="Transcript et notes d’appel"
              description="Base de travail conservée pour garder la trace du contexte commercial."
            >
              <p className="text-sm leading-7">{deal.transcript}</p>
              <div className="mt-4 rounded-md border bg-secondary/50 p-3">
                <p className="text-muted-foreground text-xs font-medium">
                  Contexte complémentaire
                </p>
                <p className="mt-2 text-sm leading-6">{deal.additionalContext}</p>
              </div>
            </ActionCard>

            <section className="border bg-card/80">
              <div className="border-b px-4 py-3.5">
                <h2 className="text-[0.82rem] font-semibold tracking-[-0.01em]">
                  Production documentaire
                </h2>
                <p className="text-muted-foreground mt-1 text-sm leading-5">
                  Les éléments qui structurent la proposition, le document final
                  et la signature.
                </p>
              </div>
              <div className="divide-y">
                <article className="grid gap-3 px-4 py-4 lg:grid-cols-[12rem_1fr]">
                  <h3 className="text-sm font-medium">Compte-rendu</h3>
                  <p className="text-muted-foreground text-sm leading-7">
                    {deal.callSummary}
                  </p>
                </article>
                <article className="grid gap-3 px-4 py-4 lg:grid-cols-[12rem_1fr]">
                  <h3 className="text-sm font-medium">Proposition</h3>
                  <div>
                    <p className="text-sm font-medium">{deal.proposalTitle}</p>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      {deal.proposalExcerpt}
                    </p>
                  </div>
                </article>
                <article className="grid gap-3 px-4 py-4 lg:grid-cols-[12rem_1fr]">
                  <h3 className="text-sm font-medium">Document final</h3>
                  <div>
                    <p className="font-mono text-sm">{deal.finalDocumentName}</p>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      Document final prêt à être partagé lorsque la proposition
                      est validée.
                    </p>
                  </div>
                </article>
                <article className="grid gap-3 px-4 py-4 lg:grid-cols-[12rem_1fr]">
                  <h3 className="text-sm font-medium">Signature</h3>
                  <div>
                    <p className="text-sm font-medium">
                      Lien de signature préparé
                    </p>
                    <p className="text-muted-foreground mt-2 break-all text-sm leading-6">
                      {deal.signatureUrl}
                    </p>
                  </div>
                </article>
              </div>
            </section>

            <ActionCard title="Brouillon email">
              <div className="rounded-md border bg-secondary/40 p-3">
                <p className="text-sm font-medium">{deal.emailDraft.subject}</p>
                <p className="text-muted-foreground mt-3 whitespace-pre-line text-sm leading-6">
                  {deal.emailDraft.body}
                </p>
              </div>
              <p className="text-muted-foreground mt-3 text-xs">
                Consigne : {deal.emailInstructions}
              </p>
            </ActionCard>

            <ActionCard title="Journal d’activité">
              <ActivityLog items={activity} />
            </ActionCard>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <ActionCard
              title="Actions"
              description="Commandes principales du cycle de proposition."
            >
              <DealActionPanel dealId={deal.id} />
            </ActionCard>
            <ActionCard title="Progression">
              <WorkflowTimeline status={deal.status} compact />
            </ActionCard>
            <ActionCard title="Dernière mise à jour">
              <p className="text-sm font-medium">{deal.lastAction}</p>
              <p className="text-muted-foreground mt-2 text-sm">
                {formatDateTime(deal.updatedAt)}
              </p>
            </ActionCard>
          </aside>
        </div>
      </div>
    </PageTransition>
  );
}
