import { notFound } from "next/navigation";
import { ActionCard } from "@/components/common/action-card";
import { ActivityLog } from "@/components/common/activity-log";
import { DealStatusBadge } from "@/components/common/deal-status-badge";
import { PageTransition } from "@/components/common/page-transition";
import { WorkflowTimeline } from "@/components/common/workflow-timeline";
import { T } from "@/components/i18n/translated-text";
import { CallSummaryPanel } from "@/components/deals/call-summary-panel";
import { DealActionPanel } from "@/components/deals/deal-action-panel";
import { DealEditDialog } from "@/components/deals/deal-edit-dialog";
import { DealTranscriptLink } from "@/components/deals/deal-transcript-link";
import {
  GeneratedDocumentButtons,
  GeneratedDocumentsPanel,
} from "@/components/deals/generated-documents-panel";
import { ProposalPanel } from "@/components/deals/proposal-panel";
import { TranscriptPanel } from "@/components/deals/transcript-panel";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getDealDetail } from "@/lib/data/supabase-app-data";
import { getLinkedTranscriptForDeal, getTranscriptsForLinking } from "@/lib/data/transcripts";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { normalizeWorkspaceRole } from "@/lib/auth/workspace-permissions";

type DealDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { id } = await params;
  const context = await requireCurrentUserContext();
  const { deal, activity, documents } = await getDealDetail(
    context.organization?.id ?? null,
    id,
    {
      userId: context.user.id,
      role: context.membership?.role,
      allowMemberCompanyVisibility:
        context.organization?.allow_member_company_visibility ?? true,
      scope: "organization",
    },
  );

  if (!deal) {
    notFound();
  }

  const organizationId = context.organization?.id ?? "";
  const userRole = normalizeWorkspaceRole(context.membership?.role);
  const canEdit = userRole !== "viewer";

  const [linkedTranscript, availableTranscripts] = await Promise.all([
    getLinkedTranscriptForDeal(organizationId, id),
    canEdit ? getTranscriptsForLinking(organizationId) : Promise.resolve([]),
  ]);

  const quoteDocument = documents.find(
    (document) => document.type === "quote_pdf",
  );
  const finalDocument = documents.find(
    (document) => document.type === "final_document_pdf",
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        <header className="bg-card/45 grid gap-4 rounded-lg border p-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
              <T tx="dealDetail.eyebrow" />
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {deal.name}
              </h1>
              <DealStatusBadge status={deal.status} />
              <DealEditDialog deal={deal} />
            </div>
            <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
              {deal.clientCompanyName} · {deal.lastAction}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:text-right">
            <div>
              <p className="text-muted-foreground text-xs">Budget</p>
              <p className="font-mono font-semibold">
                {formatCurrency(deal.amountEstimate)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">
                <T tx="dealDetail.created" />
              </p>
              <p>{formatDate(deal.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">
                <T tx="dealDetail.updated" />
              </p>
              <p>{formatDate(deal.updatedAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">
                <T tx="dealDetail.owner" />
              </p>
              <p>{deal.ownerName}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2">
              <ActionCard title={<T tx="dealDetail.clientCompany" />}>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">
                      <T tx="dealDetail.organization" />
                    </dt>
                    <dd className="mt-1 font-medium">
                      {deal.clientCompanyName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      <T tx="dealDetail.source" />
                    </dt>
                    <dd className="mt-1">{deal.source}</dd>
                  </div>
                </dl>
              </ActionCard>

              <ActionCard title={<T tx="dealDetail.contact" />}>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">
                      <T tx="dealDetail.name" />
                    </dt>
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
                      <dt className="text-muted-foreground">
                        <T tx="dealDetail.phone" />
                      </dt>
                      <dd className="mt-1">{deal.clientPhone}</dd>
                    </div>
                  ) : null}
                </dl>
              </ActionCard>
            </section>

            <ActionCard
              title={<T tx="dealDetail.transcriptTitle" />}
              description={<T tx="dealDetail.transcriptDescription" />}
            >
              <TranscriptPanel
                transcript={deal.transcript}
                additionalContext={deal.additionalContext}
              />
              <div className="mt-3 border-t pt-3">
                <DealTranscriptLink
                  dealId={deal.id}
                  linkedTranscript={linkedTranscript}
                  availableTranscripts={availableTranscripts}
                  canEdit={canEdit}
                />
              </div>
            </ActionCard>

            <section className="bg-card/80 overflow-hidden rounded-lg border">
              <div className="border-b px-4 py-3.5">
                <h2 className="text-[0.82rem] font-semibold tracking-[-0.01em]">
                  <T tx="dealDetail.productionTitle" />
                </h2>
                <p className="text-muted-foreground mt-1 text-sm leading-5">
                  <T tx="dealDetail.productionDescription" />
                </p>
              </div>
              <div className="divide-y">
                <article className="grid gap-3 px-4 py-4 lg:grid-cols-[12rem_1fr]">
                  <h3 className="text-sm font-medium">
                    <T tx="dealDetail.callSummary" />
                  </h3>
                  <CallSummaryPanel
                    dealId={deal.id}
                    summary={deal.callSummary}
                    hasSummary={deal.hasCallSummary}
                  />
                </article>
                <article className="grid gap-3 px-4 py-4 lg:grid-cols-[12rem_1fr]">
                  <h3 className="text-sm font-medium">
                    <T tx="dealDetail.proposal" />
                  </h3>
                  <ProposalPanel
                    dealId={deal.id}
                    content={deal.proposalExcerpt}
                    hasProposal={deal.hasProposal}
                    editUrl={deal.proposalEditUrl}
                  />
                </article>
                <article className="grid gap-3 px-4 py-4 lg:grid-cols-[12rem_1fr]">
                  <h3 className="text-sm font-medium">
                    <T tx="dealDetail.finalDocument" />
                  </h3>
                  <div>
                    <p className="font-mono text-sm">
                      {finalDocument?.title ?? deal.finalDocumentName}
                    </p>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      {finalDocument
                        ? <T tx="dealDetail.finalDocumentReady" />
                        : <T tx="dealDetail.finalDocumentWaiting" />}
                    </p>
                    <div className="mt-3">
                      <GeneratedDocumentButtons
                        document={finalDocument}
                        compact
                        showOpen={false}
                        downloadLabel={<T tx="common.actions.downloadFinalDocument" />}
                      />
                    </div>
                  </div>
                </article>
                <article className="grid gap-3 px-4 py-4 lg:grid-cols-[12rem_1fr]">
                  <h3 className="text-sm font-medium">
                    <T tx="dealDetail.signature" />
                  </h3>
                  <div>
                    <p className="text-sm font-medium">
                      <T tx="dealDetail.signaturePrepared" />
                    </p>
                    <p className="text-muted-foreground mt-2 text-sm leading-6 break-all">
                      {deal.signatureUrl}
                    </p>
                  </div>
                </article>
              </div>
            </section>

            <ActionCard
              title={<T tx="dealDetail.generatedDocuments" />}
              description={<T tx="dealDetail.generatedDocumentsDescription" />}
            >
              <GeneratedDocumentsPanel documents={documents} />
            </ActionCard>

            <ActionCard title={<T tx="dealDetail.emailDraft" />}>
              <div className="bg-secondary/40 rounded-md border p-3">
                <p className="text-sm font-medium">{deal.emailDraft.subject}</p>
                <p className="text-muted-foreground mt-3 text-sm leading-6 whitespace-pre-line">
                  {deal.emailDraft.body}
                </p>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-xs">
                  <T
                    tx="dealDetail.instructions"
                    params={{ instructions: deal.emailInstructions }}
                  />
                </p>
                <DealEditDialog
                  deal={deal}
                  triggerLabel={<T tx="common.actions.editInstructions" />}
                  triggerSize="sm"
                />
              </div>
            </ActionCard>

            <ActionCard title={<T tx="dealDetail.activity" />}>
              <ActivityLog items={activity} />
            </ActionCard>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <ActionCard
              title={<T tx="dealDetail.actions" />}
              description={<T tx="dealDetail.actionsDescription" />}
            >
              <DealActionPanel
                dealId={deal.id}
                status={deal.status}
                hasCallSummary={deal.hasCallSummary}
                hasProposal={deal.hasProposal}
                proposalEditUrl={deal.proposalEditUrl}
                quoteDocument={quoteDocument}
                finalDocument={finalDocument}
              />
            </ActionCard>
            <ActionCard title={<T tx="dealDetail.progress" />}>
              <WorkflowTimeline status={deal.status} compact />
            </ActionCard>
            <ActionCard title={<T tx="dealDetail.lastUpdated" />}>
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
