import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText, ScrollText } from "lucide-react";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/common/page-transition";
import { AdviceCreator } from "@/components/broker/advice-creator";
import { AdviceStatusBadge } from "@/components/broker/advice-status-badge";
import { BrokerStatusBadge } from "@/components/broker/broker-status-badge";
import { ClaimManager } from "@/components/broker/claim-manager";
import { ClientDocuments } from "@/components/broker/client-documents";
import { ClientIntroducerSelect } from "@/components/broker/client-introducer-select";
import { ClientStatusControl } from "@/components/broker/client-status-control";
import { CommissionStatusBadge } from "@/components/broker/commission-status-badge";
import { CompliancePanel } from "@/components/broker/compliance-panel";
import { ContractManager } from "@/components/broker/contract-manager";
import { NeedsQuestionnaire } from "@/components/broker/needs-questionnaire";
import { QuoteImporter } from "@/components/broker/quote-importer";
import { QuoteStatusBadge } from "@/components/broker/quote-status-badge";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
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
  getBrokerIntroducers,
} from "@/lib/broker/data";
import { formatEuro, netCommission } from "@/lib/broker/commissions";
import { parseBrokerSettings } from "@/lib/broker/settings";
import { brokerActivityLabel } from "@/lib/broker/activity";
import { formatPremium } from "@/lib/broker/quotes";
import { computeStorageUsage } from "@/lib/broker/storage";
import { formatDate, formatDateTime } from "@/lib/format";

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
      className="rounded-lg border bg-[var(--bg-surface)] p-5"
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

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-[12.5px] text-[var(--fg-3)]">{label}</span>
      <span className="text-right text-[13px] font-medium text-[var(--fg-1)]">
        {value || "—"}
      </span>
    </div>
  );
}

export default async function BrokerClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;
  const { id } = await params;

  const client = await getBrokerClient(organizationId, id);
  if (!client) {
    notFound();
  }

  const [
    activity,
    documents,
    quotes,
    advice,
    contracts,
    compliance,
    commissions,
    claims,
    introducers,
  ] = await Promise.all([
    getBrokerClientActivity(organizationId, id),
    getBrokerClientDocuments(organizationId, id),
    getBrokerClientQuotes(organizationId, id),
    getBrokerClientAdvice(organizationId, id),
    getBrokerClientContracts(organizationId, id),
    getBrokerClientCompliance(organizationId, id),
    getBrokerClientCommissions(organizationId, id),
    getBrokerClientClaims(organizationId, id),
    getBrokerIntroducers(organizationId),
  ]);
  const claimContractOptions = contracts.map((c) => ({
    id: c.id,
    label: contractDisplayLabel(c),
  }));
  const displayName = brokerClientDisplayName(client);
  const canEdit = canCreateWorkspaceRecords(context.membership?.role);
  const brokerSettings = parseBrokerSettings(context.organization);
  const storageFull = computeStorageUsage(context.organization).isFull;
  const hasValidatedQuote = quotes.some(
    (q) => q.extraction_status === "validated",
  );

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

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="fd-eyebrow mb-2">
              {client.client_type === "company" ? "Entreprise" : "Particulier"}
              {client.insurance_type
                ? ` · ${insuranceTypeLabel(client.insurance_type)}`
                : ""}
            </p>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[var(--fg-1)] sm:text-[30px]">
              {displayName}
            </h1>
            <div className="mt-3">
              <BrokerStatusBadge status={client.status} />
            </div>
          </div>
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <span className="fd-eyebrow">Statut du dossier</span>
            <ClientStatusControl clientId={client.id} status={client.status} />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
          <div className="space-y-5">
            <Card title="Informations client">
              <div className="divide-y" style={{ borderColor: "var(--border-1)" }}>
                <InfoRow label="Email" value={client.email} />
                <InfoRow label="Téléphone" value={client.phone} />
                <InfoRow
                  label="Adresse"
                  value={
                    [client.address, client.postal_code, client.city]
                      .filter(Boolean)
                      .join(", ") || null
                  }
                />
                <InfoRow
                  label="Branche"
                  value={insuranceTypeLabel(client.insurance_type)}
                />
              </div>
            </Card>

            <Card
              title="Recueil de besoins"
              description="Votre base de travail pour le devoir de conseil."
            >
              <NeedsQuestionnaire
                clientId={client.id}
                branch={client.insurance_type}
                initialData={client.structured_needs}
                initialNeeds={client.needs}
                canEdit={canEdit}
              />
              {client.notes ? (
                <div
                  className="mt-4 rounded-md border px-4 py-3"
                  style={{
                    borderColor: "var(--border-1)",
                    background: "var(--brand-navy-50)",
                  }}
                >
                  <p className="fd-eyebrow mb-1">Notes internes</p>
                  <p className="whitespace-pre-wrap text-[12.5px] leading-5 text-[var(--fg-2)]">
                    {client.notes}
                  </p>
                </div>
              ) : null}
            </Card>

            <Card
              title="Documents du dossier"
              description="Contrats, pièces d’identité, RIB, devis compagnies et autres pièces."
            >
              <ClientDocuments
                clientId={client.id}
                documents={documents}
                canEdit={canEdit}
                storageFull={storageFull}
              />
            </Card>

            {brokerSettings.complianceEnabled ? (
              <Card
                title="Conformité — DDA / LCB-FT / RGPD"
                description="Obligations réglementaires du dossier : fiche d’information, vérification d’identité, classification du risque et consentements."
              >
                <CompliancePanel
                  clientId={client.id}
                  compliance={compliance}
                  documents={documents}
                  canEdit={canEdit}
                />
              </Card>
            ) : null}

            <Card
              title="Contrats"
              description="Les contrats en cours du client, leurs échéances et leurs renouvellements."
            >
              <ContractManager
                clientId={client.id}
                contracts={contracts}
                branches={brokerSettings.enabledBranches}
                insurers={brokerSettings.partnerInsurers}
                canEdit={canEdit}
              />
            </Card>

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

            {commissions.length > 0 ? (
              <Card
                title="Commissions"
                description="Les commissions liées à ce dossier, saisies depuis les bordereaux compagnies."
              >
                <ul
                  className="divide-y overflow-hidden rounded-md border"
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
                    className="divide-y overflow-hidden rounded-md border"
                    style={{ borderColor: "var(--border-1)" }}
                  >
                    {quotes.map((quote) => (
                      <li key={quote.id}>
                        <Link
                          href={`/courtier/clients/${client.id}/quotes/${quote.id}`}
                          className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-[rgba(14,34,56,0.025)]"
                          style={{ background: "var(--bg-surface)" }}
                        >
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                            style={{
                              background: "var(--brand-navy-50)",
                              border: "1px solid var(--border-1)",
                              color: "var(--brand-navy-700)",
                            }}
                          >
                            <ScrollText
                              className="size-4"
                              strokeWidth={1.75}
                            />
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

            <Card
              title="Devoir de conseil"
              description="Généré à partir des besoins du client et du devis validé, modifiable et validable avant envoi."
            >
              <div className="space-y-4">
                <AdviceCreator
                  clientId={client.id}
                  hasValidatedQuote={hasValidatedQuote}
                  canEdit={canEdit}
                />

                {advice.length > 0 ? (
                  <ul
                    className="divide-y overflow-hidden rounded-md border"
                    style={{ borderColor: "var(--border-1)" }}
                  >
                    {advice.map((doc) => (
                      <li key={doc.id}>
                        <Link
                          href={`/courtier/clients/${client.id}/advice/${doc.id}`}
                          className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-[rgba(14,34,56,0.025)]"
                          style={{ background: "var(--bg-surface)" }}
                        >
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                            style={{
                              background: "var(--brand-navy-50)",
                              border: "1px solid var(--border-1)",
                              color: "var(--brand-navy-700)",
                            }}
                          >
                            <FileText className="size-4" strokeWidth={1.75} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                              {doc.title}
                            </p>
                            <p className="truncate text-[11.5px] text-[var(--fg-3)]">
                              Mis à jour le {formatDate(doc.updated_at)}
                            </p>
                          </div>
                          <AdviceStatusBadge status={doc.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card
              title="Apporteur"
              description="L’apporteur qui a amené ce client. Sa rétrocession s’applique automatiquement à ses commissions."
            >
              <ClientIntroducerSelect
                clientId={client.id}
                introducers={introducers.map((i) => ({
                  id: i.id,
                  name: i.name,
                }))}
                currentIntroducerId={client.introducer_id}
                canEdit={canEdit}
              />
            </Card>

            <Card
              title="Historique"
              description="Toutes les actions sur ce dossier."
            >
              {activity.length > 0 ? (
                <ol className="space-y-4">
                  {activity.map((entry) => (
                    <li key={entry.id} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-1.5 size-2 shrink-0 rounded-full"
                        style={{ background: "var(--accent)" }}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[var(--fg-1)]">
                          {brokerActivityLabel(entry.type)}
                        </p>
                        {entry.description ? (
                          <p className="mt-0.5 text-[12px] leading-5 text-[var(--fg-3)]">
                            {entry.description}
                          </p>
                        ) : null}
                        <p className="mt-0.5 font-mono text-[11px] text-[var(--fg-4)]">
                          {formatDateTime(entry.created_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[13px] text-[var(--fg-3)]">
                  Aucune action enregistrée pour le moment.
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
