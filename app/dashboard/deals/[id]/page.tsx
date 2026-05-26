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
import { PageBreadcrumb } from "@/components/common/page-breadcrumb";

type DealDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { id } = await params;
  const context = await requireCurrentUserContext();

  const organizationId = context.organization?.id ?? "";
  const userRole = normalizeWorkspaceRole(context.membership?.role);
  const canEdit = userRole !== "viewer";

  const [{ deal, activity, documents }, linkedTranscript, availableTranscripts] =
    await Promise.all([
      getDealDetail(context.organization?.id ?? null, id, {
        userId: context.user.id,
        role: context.membership?.role,
        allowMemberCompanyVisibility:
          context.organization?.allow_member_company_visibility ?? true,
        scope: "organization",
      }),
      getLinkedTranscriptForDeal(organizationId, id),
      canEdit ? getTranscriptsForLinking(organizationId) : Promise.resolve([]),
    ]);

  if (!deal) {
    notFound();
  }

  const quoteDocument = documents.find(
    (document) => document.type === "quote_pdf" || document.type === "billing_quote",
  );
  const finalDocument = documents.find(
    (document) => document.type === "final_document_pdf",
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageBreadcrumb parent="Dossiers" parentHref="/dashboard/deals" current={deal.name} />
        <header
          className="grid gap-5 rounded-lg border bg-[var(--background-card)] p-5 lg:grid-cols-[1fr_auto] lg:items-end"
          style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
              <T tx="dealDetail.eyebrow" />
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
                {deal.name}
              </h1>
              <DealStatusBadge status={deal.status} />
              <DealEditDialog deal={deal} />
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
              {deal.clientCompanyName} · {deal.lastAction}
            </p>
          </div>
          <dl className="flex flex-wrap items-stretch gap-x-5 gap-y-3 lg:justify-end lg:divide-x lg:divide-[var(--border)]">
            <div className="lg:px-5 lg:first:pl-0 lg:last:pr-0">
              <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                Budget
              </dt>
              <dd className="mt-1 font-mono text-[13px] font-medium text-[var(--foreground)]">
                {formatCurrency(deal.amountEstimate)}
              </dd>
            </div>
            <div className="lg:px-5">
              <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                <T tx="dealDetail.created" />
              </dt>
              <dd className="mt-1 text-[13px] text-[var(--foreground)]">
                {formatDate(deal.createdAt)}
              </dd>
            </div>
            <div className="lg:px-5">
              <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                <T tx="dealDetail.updated" />
              </dt>
              <dd className="mt-1 text-[13px] text-[var(--foreground)]">
                {formatDate(deal.updatedAt)}
              </dd>
            </div>
            <div className="lg:px-5 lg:last:pr-0">
              <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                <T tx="dealDetail.owner" />
              </dt>
              <dd className="mt-1 text-[13px] text-[var(--foreground)]">
                {deal.ownerName}
              </dd>
            </div>
          </dl>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2">
              <ActionCard title={<T tx="dealDetail.clientCompany" />}>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--muted-foreground)]">
                      <T tx="dealDetail.organization" />
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">
                      {deal.clientCompanyName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--muted-foreground)]">
                      <T tx="dealDetail.source" />
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">
                      {deal.source}
                    </dd>
                  </div>
                </dl>
              </ActionCard>

              <ActionCard title={<T tx="dealDetail.contact" />}>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--muted-foreground)]">
                      <T tx="dealDetail.name" />
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">
                      {deal.clientContactName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--muted-foreground)]">
                      Email
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">
                      {deal.clientEmail}
                    </dd>
                  </div>
                  {deal.clientPhone ? (
                    <div>
                      <dt className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--muted-foreground)]">
                        <T tx="dealDetail.phone" />
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">
                        {deal.clientPhone}
                      </dd>
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

            <section
              className="overflow-hidden rounded-lg border bg-[var(--background-card)]"
              style={{
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                className="border-b px-4 py-3.5"
                style={{ borderColor: "var(--border)" }}
              >
                <h2 className="text-[13px] font-medium tracking-[-0.005em] text-[var(--foreground)]">
                  <T tx="dealDetail.productionTitle" />
                </h2>
                <p className="mt-1 text-sm leading-5 text-[var(--muted-foreground)]">
                  <T tx="dealDetail.productionDescription" />
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                <article className="grid gap-3 px-4 py-4 lg:grid-cols-[12rem_1fr]">
                  <h3 className="text-[13px] font-medium text-[var(--foreground)]">
                    <T tx="dealDetail.callSummary" />
                  </h3>
                  <CallSummaryPanel
                    dealId={deal.id}
                    summary={deal.callSummary}
                    hasSummary={deal.hasCallSummary}
                  />
                </article>
                <article className="grid gap-3 px-4 py-4 lg:grid-cols-[12rem_1fr]">
                  <h3 className="text-[13px] font-medium text-[var(--foreground)]">
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
                  <h3 className="text-[13px] font-medium text-[var(--foreground)]">
                    <T tx="dealDetail.finalDocument" />
                  </h3>
                  <div>
                    <p className="font-mono text-sm text-[var(--foreground)]">
                      {finalDocument?.title ?? deal.finalDocumentName}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
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
                  <h3 className="text-[13px] font-medium text-[var(--foreground)]">
                    <T tx="dealDetail.signature" />
                  </h3>
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      <T tx="dealDetail.signaturePrepared" />
                    </p>
                    <p className="mt-2 break-all text-sm leading-6 text-[var(--muted-foreground)]">
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
              <ActivityLog items={activity} collapsible initialCount={3} />
            </ActionCard>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <section
              className="rounded-lg border bg-[var(--background-card)] p-4"
              style={{
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="mb-3">
                <h2 className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                  <T tx="dealDetail.actions" />
                </h2>
                <p className="mt-1 text-sm leading-5 text-[var(--muted-foreground)]">
                  <T tx="dealDetail.actionsDescription" />
                </p>
              </div>
              <DealActionPanel
                dealId={deal.id}
                status={deal.status}
                hasCallSummary={deal.hasCallSummary}
                hasProposal={deal.hasProposal}
                proposalEditUrl={deal.proposalEditUrl}
                quoteDocument={quoteDocument}
                finalDocument={finalDocument}
              />
            </section>
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
