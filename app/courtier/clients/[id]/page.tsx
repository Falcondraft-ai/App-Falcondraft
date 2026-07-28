import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText, ScrollText } from "lucide-react";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/common/page-transition";
import { AdviceCreator } from "@/components/broker/advice-creator";
import { AdviceCard } from "@/components/broker/advice-workspace";
import { BrokerStatusBadge } from "@/components/broker/broker-status-badge";
import { ClaimManager } from "@/components/broker/claim-manager";
import { ClientDeleteButton } from "@/components/broker/client-delete-button";
import { ClientDocuments } from "@/components/broker/client-documents";
import { ClientEmails } from "@/components/broker/client-emails";
import { ClientHistory } from "@/components/broker/client-history";
import { ClientInfoEditor } from "@/components/broker/client-info-editor";
import { ClientRenameDialog } from "@/components/broker/client-rename-dialog";
import { ClientStatusControl } from "@/components/broker/client-status-control";
import { CommissionStatusBadge } from "@/components/broker/commission-status-badge";
import { ContractManager } from "@/components/broker/contract-manager";
import { QuoteDeleteButton } from "@/components/broker/quote-delete-button";
import { QuoteImporter } from "@/components/broker/quote-importer";
import { QuoteStatusBadge } from "@/components/broker/quote-status-badge";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import {
  canCreateWorkspaceRecords,
  isWorkspaceManager,
} from "@/lib/auth/workspace-permissions";
import { hasProposalAutomation } from "@/lib/billing/entitlements";
import {
  brokerClientDisplayName,
  insuranceTypeLabel,
} from "@/lib/broker/clients";
import { contractDisplayLabel } from "@/lib/broker/contracts";
import {
  getBrokerClient,
  getBrokerClientActivity,
  getBrokerClientAdvice,
  getBrokerClientClaims,
  getBrokerClientCommissions,
  getBrokerClientCompliance,
  getBrokerClientContracts,
  getBrokerClientDocuments,
  getBrokerClientQuotes,
} from "@/lib/broker/data";
import { formatEuro, netCommission } from "@/lib/broker/commissions";
import { parseBrokerSettings } from "@/lib/broker/settings";
import { formatPremium } from "@/lib/broker/quotes";
import { computeStorageUsage } from "@/lib/broker/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Card({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className="rounded-xl border bg-[var(--bg-surface)] p-5"
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--fg-1)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-[12.5px] leading-5 text-[var(--fg-3)]">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function BrokerClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireActiveWorkspaceContext();
  const organization = context.organization!;
  const organizationId = organization.id;
  const { id } = await params;

  const client = await getBrokerClient(organizationId, id);
  if (!client) {
    notFound();
  }

  const saasModules = hasProposalAutomation(organization);

  const [activity, documents, quotes, advice, contracts, compliance] =
    await Promise.all([
      getBrokerClientActivity(organizationId, id),
      getBrokerClientDocuments(organizationId, id),
      getBrokerClientQuotes(organizationId, id),
      getBrokerClientAdvice(organizationId, id),
      getBrokerClientContracts(organizationId, id),
      getBrokerClientCompliance(organizationId, id),
    ]);
  const pep: "Oui" | "Non" | null = compliance
    ? compliance.is_pep
      ? "Oui"
      : "Non"
    : null;

  // Commissions & sinistres only exist in the SaaS broker offering.
  const [commissions, claims] = saasModules
    ? await Promise.all([
        getBrokerClientCommissions(organizationId, id),
        getBrokerClientClaims(organizationId, id),
      ])
    : [[], []];

  const claimContractOptions = contracts.map((c) => ({
    id: c.id,
    label: contractDisplayLabel(c),
  }));
  const displayName = brokerClientDisplayName(client);
  const canEdit = canCreateWorkspaceRecords(context.membership?.role);
  const canDelete = isWorkspaceManager(context.membership?.role);
  const brokerSettings = parseBrokerSettings(organization);
  const storageFull = computeStorageUsage(organization).isFull;
  const hasValidatedQuote = quotes.some(
    (q) => q.extraction_status === "validated",
  );
  const branchLabel = client.insurance_type
    ? insuranceTypeLabel(client.insurance_type)
    : null;

  return (
    <PageTransition>
      <div className="space-y-5">
        <nav
          className="flex items-center gap-1.5 text-[12px]"
          style={{ color: "var(--fg-3)" }}
          aria-label="Breadcrumb"
        >
          <Link href="/courtier/clients" className="hover:text-[var(--fg-1)]">
            Dossiers clients
          </Link>
          <ChevronRight className="size-3" strokeWidth={2} aria-hidden="true" />
          <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>
            {displayName}
          </span>
        </nav>

        {/* Hero header — sobre, sans dégradé ni avatar */}
        <header
          className="rounded-xl border bg-[var(--bg-surface)] px-5 py-5 sm:px-6"
          style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="fd-eyebrow flex items-center gap-2 text-[var(--accent-foreground)]">
                <span>Dossier</span>
                {branchLabel ? (
                  <>
                    <span aria-hidden className="opacity-40">
                      ·
                    </span>
                    <span>{branchLabel}</span>
                  </>
                ) : null}
              </p>
              <div className="mt-2 flex items-center gap-2.5">
                <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[var(--fg-1)] sm:text-[30px]">
                  {displayName}
                </h1>
                {canEdit ? (
                  <ClientRenameDialog
                    clientId={client.id}
                    clientType={
                      client.client_type === "company" ? "company" : "individual"
                    }
                    firstName={client.first_name}
                    lastName={client.last_name}
                    companyName={client.company_name}
                  />
                ) : null}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--fg-2)]"
                  style={{
                    borderColor: "var(--border-1)",
                    background: "var(--bg-sunken)",
                  }}
                >
                  {client.client_type === "company"
                    ? "Entreprise"
                    : "Particulier"}
                </span>
                <BrokerStatusBadge status={client.status} />
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
              <span className="fd-eyebrow">Statut du dossier</span>
              <ClientStatusControl clientId={client.id} status={client.status} />
              {canDelete ? (
                <div className="mt-1.5">
                  <ClientDeleteButton
                    clientId={client.id}
                    clientName={displayName}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          {/* Main column — parcours logique : infos → contrats → devis → conseil */}
          <div className="space-y-5">
            <ClientInfoEditor client={client} canEdit={canEdit} />

            <Card
              title="Contrats"
              description="Importez un contrat au format PDF ou saisissez-le : échéances et renouvellements sont suivis automatiquement."
            >
              <ContractManager
                clientId={client.id}
                contracts={contracts}
                branches={brokerSettings.enabledBranches}
                insurers={brokerSettings.partnerInsurers}
                canEdit={canEdit}
                storageFull={storageFull}
              />
            </Card>

            <Card
              title="Devis compagnie"
              description="Importez un devis reçu d’une compagnie, vérifiez les informations puis validez."
            >
              <div className="space-y-4">
                <QuoteImporter
                  clientId={client.id}
                  canEdit={canEdit}
                  storageFull={storageFull}
                />

                {quotes.length > 0 ? (
                  <ul
                    className="divide-y overflow-hidden rounded-lg border"
                    style={{ borderColor: "var(--border-1)" }}
                  >
                    {quotes.map((quote) => (
                      <li
                        key={quote.id}
                        className="flex items-center"
                        style={{ background: "var(--bg-surface)" }}
                      >
                        <Link
                          href={`/courtier/clients/${client.id}/quotes/${quote.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 transition-colors hover:bg-[var(--bg-sunken)]"
                        >
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                            style={{
                              background: "var(--brand-navy-50)",
                              border: "1px solid var(--border-1)",
                              color: "var(--brand-navy-700)",
                            }}
                          >
                            <ScrollText className="size-4" strokeWidth={1.75} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                              {quote.insurer_name || "Devis à compléter"}
                              {quote.product_name
                                ? ` — ${quote.product_name}`
                                : ""}
                            </p>
                            <p className="truncate text-[11.5px] text-[var(--fg-3)]">
                              {quote.premium_monthly
                                ? `${formatPremium(quote.premium_monthly, quote.currency)} / mois`
                                : quote.premium_annual
                                  ? `${formatPremium(quote.premium_annual, quote.currency)} / an`
                                  : "Montant à renseigner"}
                            </p>
                          </div>
                          <QuoteStatusBadge status={quote.extraction_status} />
                        </Link>
                        {canDelete ? (
                          <QuoteDeleteButton
                            clientId={client.id}
                            quoteId={quote.id}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12.5px] text-[var(--fg-3)]">
                    Aucun devis importé. Importez un PDF reçu d’une compagnie pour
                    commencer.
                  </p>
                )}
              </div>
            </Card>

            {/* Devoir de conseil — après le devis (logique du parcours) */}
            <section
              className="rounded-xl border bg-[var(--bg-surface)]"
              style={{
                borderColor: "var(--border-1)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                className="flex items-center gap-2.5 border-b px-5 py-3.5"
                style={{ borderColor: "var(--border-1)" }}
              >
                <span
                  className="flex size-7 items-center justify-center rounded-md"
                  style={{
                    background: "var(--accent-soft)",
                    border: "1px solid rgba(184,146,42,0.25)",
                    color: "var(--accent-foreground)",
                  }}
                >
                  <FileText className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--fg-1)]">
                    Devoir de conseil
                  </h2>
                  <p className="text-[11.5px] text-[var(--fg-3)]">
                    {saasModules
                      ? "Relisez le contenu, validez-le, puis générez le PDF et le lien de signature."
                      : "Relisez le contenu, validez-le, puis générez le PDF — téléchargeable directement ici."}
                  </p>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <AdviceCreator
                  client={client}
                  pep={pep}
                  hasValidatedQuote={hasValidatedQuote}
                  canEdit={canEdit}
                  alreadyExists={advice.length > 0}
                />

                {advice.length > 0 ? (
                  <div className="space-y-2">
                    {advice.map((doc) => (
                      <AdviceCard
                        key={doc.id}
                        advice={doc}
                        clientId={client.id}
                        pdfDocumentId={
                          documents.find((d) =>
                            d.storage_path.endsWith(
                              `devoir-de-conseil-${doc.id}.pdf`,
                            ),
                          )?.id ?? null
                        }
                        canDelete={canDelete}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <Card
              title="Documents du dossier"
              description="Contrats, pièces d’identité, RIB et autres pièces."
            >
              <ClientDocuments
                clientId={client.id}
                documents={documents}
                canEdit={canEdit}
                storageFull={storageFull}
              />
            </Card>

            {saasModules ? (
              <Card
                title="Sinistres"
                description="Suivez les sinistres déclarés par le client, leur instruction et leur indemnisation."
              >
                <ClaimManager
                  clientId={client.id}
                  claims={claims}
                  contracts={claimContractOptions}
                  canEdit={canEdit}
                />
              </Card>
            ) : null}
          </div>

          {/* Rail — emails (utile, prend la largeur), commissions, historique discret */}
          <div className="space-y-5">
            <ClientEmails clientId={client.id} />

            {saasModules && commissions.length > 0 ? (
              <Card
                title="Commissions"
                description="Les commissions liées à ce dossier."
              >
                <ul
                  className="divide-y overflow-hidden rounded-lg border"
                  style={{ borderColor: "var(--border-1)" }}
                >
                  {commissions.map((line) => (
                    <li
                      key={line.id}
                      className="flex items-center gap-3 px-3.5 py-3"
                      style={{ background: "var(--bg-surface)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                          {line.label || line.insurer_name || "Commission"}
                        </p>
                        <p className="truncate text-[11.5px] text-[var(--fg-3)]">
                          {line.period_label || "Période non précisée"}
                          {line.retrocession_amount
                            ? ` · Net ${formatEuro(netCommission(line), line.currency)}`
                            : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold text-[var(--fg-1)]">
                        {formatEuro(line.commission_amount, line.currency)}
                      </span>
                      <CommissionStatusBadge status={line.status} kind="line" />
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {/* Historique — discret, replié sous le reste (déplié animé) */}
            <ClientHistory activity={activity} />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
