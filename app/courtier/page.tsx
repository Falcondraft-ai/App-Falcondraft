import Link from "next/link";
import { CalendarClock, Plus } from "lucide-react";
import {
  DashboardStatCard,
  StatStrip,
} from "@/components/common/dashboard-stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { ActivityFeed } from "@/components/broker/activity-feed";
import { BrokerStatusBadge } from "@/components/broker/broker-status-badge";
import {
  BriefingSummaryPanel,
  type EmailBriefingSummary,
} from "@/components/broker/daily-briefing";
import {
  ValidationQueue,
  type ValidationItem,
} from "@/components/broker/validation-queue";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import {
  brokerClientDisplayName,
  insuranceTypeLabel,
} from "@/lib/broker/clients";
import {
  contractDisplayLabel,
  formatContractPremium,
  renewalUrgency,
  renewalUrgencyTone,
  RENEWAL_HORIZON_DAYS,
} from "@/lib/broker/contracts";
import {
  getBrokerClients,
  getBrokerRecentActivity,
  getBrokerUpcomingRenewals,
  getEmailDigestDetail,
  getLatestEmailDigest,
} from "@/lib/broker/data";
import { getActiveBrokerProfile } from "@/lib/broker/profiles";
import { hasConnectedMailbox } from "@/lib/email/mailbox-resolver";
import { formatDate, formatLongDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CourtierDashboardPage() {
  const context = await requireActiveWorkspaceContext();
  const organization = context.organization!;
  const organizationId = organization.id;

  const [clients, activity, renewals] = await Promise.all([
    getBrokerClients(organizationId, { limit: 200 }),
    getBrokerRecentActivity(organizationId, 8),
    getBrokerUpcomingRenewals(organizationId, RENEWAL_HORIZON_DAYS),
  ]);
  const clientNames = new Map(
    clients.map((c) => [c.id, brokerClientDisplayName(c)]),
  );
  const topRenewals = renewals.slice(0, 4);

  // Résumé du briefing pour le panneau du tableau de bord — la boîte suit le
  // profil actif, et n'est pas forcément hébergée chez Microsoft.
  const activeProfile = await getActiveBrokerProfile(organizationId);
  const outlookConnection = await hasConnectedMailbox({
    organizationId,
    userId: context.user.id,
    profileId: activeProfile?.id ?? null,
  });
  const outlookConnected = outlookConnection.connected;
  const latestDigest = outlookConnected
    ? await getLatestEmailDigest(
        organizationId,
        context.user.id,
        activeProfile?.id ?? null,
      )
    : null;
  let emailSummary: EmailBriefingSummary = {
    connected: Boolean(outlookConnected),
    hasDigest: false,
    narrative: null,
    toProcess: 0,
    toConfirm: 0,
    pendingActions: 0,
    generatedAt: null,
    top: [],
  };
  let validationItems: ValidationItem[] = [];
  if (latestDigest) {
    const { items: emailItems, suggestions: emailSuggestions } =
      await getEmailDigestDetail(organizationId, latestDigest.id);
    const relevantItems = emailItems.filter((i) => i.relevance === "relevant");

    // Build the dashboard "À valider" queue from pending AI suggestions.
    const itemsById = new Map(emailItems.map((i) => [i.id, i]));
    validationItems = emailSuggestions
      .filter((s) => s.status === "pending")
      .slice(0, 6)
      .map((s) => {
        const item = itemsById.get(s.item_id);
        return {
          id: s.id,
          type: s.type,
          payload: (s.payload ?? null) as Record<string, unknown> | null,
          clientName: item?.suggested_client_id
            ? (clientNames.get(item.suggested_client_id) ?? null)
            : null,
          from: item?.from_name || item?.from_email || "Expéditeur",
          subject: item?.subject || "(sans objet)",
        };
      });
    emailSummary = {
      connected: true,
      hasDigest: true,
      narrative: latestDigest.narrative,
      toProcess: relevantItems.length,
      toConfirm: emailItems.filter((i) => i.relevance === "uncertain").length,
      pendingActions: emailSuggestions.filter((s) => s.status === "pending")
        .length,
      generatedAt: latestDigest.generated_at,
      top: [...relevantItems]
        .sort(
          (a, b) =>
            (b.urgency === "high" ? 1 : 0) - (a.urgency === "high" ? 1 : 0),
        )
        .slice(0, 3)
        .map((i) => ({
          id: i.id,
          from: i.from_name || i.from_email || "Expéditeur",
          subject: i.subject || "(sans objet)",
          urgency: i.urgency,
        })),
    };
  }

  const stats = {
    total: clients.length,
    adviceReady: clients.filter((c) => c.status === "advice_ready").length,
    awaitingSignature: clients.filter(
      (c) => c.status === "awaiting_signature",
    ).length,
    signed: clients.filter((c) => c.status === "signed").length,
  };
  const recentClients = clients.slice(0, 6);

  const firstName =
    (context.profile?.full_name ?? context.user.email ?? "").split(" ").at(0) ??
    "";
  const today = formatLongDate(new Date());
  const attention = stats.adviceReady + stats.awaitingSignature;

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          size="large"
          eyebrow={<span className="capitalize">{today}</span>}
          title={firstName ? `Bonjour ${firstName}` : "Bonjour"}
          description={
            attention > 0
              ? `${attention} dossier${attention > 1 ? "s" : ""} demande${attention > 1 ? "nt" : ""} votre attention aujourd'hui.`
              : "Voici où en sont vos dossiers clients."
          }
          actions={
            <Button asChild>
              <Link
                href="/courtier/clients/new"
                className="inline-flex items-center gap-1.5"
              >
                <Plus className="size-3.5" strokeWidth={2.25} />
                Nouveau dossier
              </Link>
            </Button>
          }
        />

        <StatStrip className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            variant="cell"
            label="Dossiers actifs"
            value={String(stats.total)}
            detail="Dossiers clients en cours de gestion"
          />
          <DashboardStatCard
            variant="cell"
            label="Devoirs de conseil à valider"
            value={String(stats.adviceReady)}
            detail="Prêts pour votre relecture"
            tone="accent"
          />
          <DashboardStatCard
            variant="cell"
            label="Signatures en attente"
            value={String(stats.awaitingSignature)}
            detail="En attente de signature client"
            tone="warning"
          />
          <DashboardStatCard
            variant="cell"
            label="Dossiers signés"
            value={String(stats.signed)}
            detail="Contrats finalisés"
            tone="success"
          />
        </StatStrip>

        <div className="grid items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
          {/* Main column: AI briefing + recent dossiers */}
          <div className="space-y-4">
            <BriefingSummaryPanel summary={emailSummary} />

            <section
              className="overflow-hidden rounded-lg border bg-[var(--bg-surface)]"
              style={{
                borderColor: "var(--border-1)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
                style={{ borderColor: "var(--border-1)" }}
              >
                <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--fg-1)]">
                  Dossiers récents
                </h2>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/courtier/clients">Voir tous les dossiers</Link>
                </Button>
              </div>
              {recentClients.length > 0 ? (
                <div className="-mx-px overflow-x-auto">
                  <Table className="min-w-[520px]">
                    <TableHeader>
                      <TableRow
                        className="hover:bg-transparent"
                        style={{ background: "var(--bg-sunken)" }}
                      >
                        <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                          Client
                        </TableHead>
                        <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                          Branche
                        </TableHead>
                        <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                          Statut
                        </TableHead>
                        <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                          Mis à jour
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentClients.map((client) => (
                        <TableRow
                          key={client.id}
                          className="duration-100 hover:bg-[rgba(14,34,56,0.025)]"
                        >
                          <TableCell>
                            <Link
                              href={`/courtier/clients/${client.id}`}
                              className="text-[13px] font-semibold text-[var(--fg-1)] transition-colors hover:text-[var(--brand-navy-800)]"
                            >
                              {brokerClientDisplayName(client)}
                            </Link>
                            {client.email ? (
                              <p className="mt-0.5 text-[11.5px] text-[var(--fg-3)]">
                                {client.email}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-[13px] text-[var(--fg-2)]">
                            {insuranceTypeLabel(client.insurance_type)}
                          </TableCell>
                          <TableCell>
                            <BrokerStatusBadge status={client.status} />
                          </TableCell>
                          <TableCell className="font-mono text-[12px] text-[var(--fg-3)]">
                            {formatDate(client.updated_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-5">
                  <EmptyState
                    title="Aucun dossier pour le moment"
                    description="Créez votre premier dossier client pour centraliser ses informations, ses documents et son devoir de conseil."
                    action={
                      <Button asChild>
                        <Link href="/courtier/clients/new">
                          Créer un dossier client
                        </Link>
                      </Button>
                    }
                  />
                </div>
              )}
            </section>
          </div>

          {/* Rail: validation queue, renewals, activity */}
          <div className="space-y-4">
            <ValidationQueue items={validationItems} />

            {topRenewals.length > 0 ? (
              <section
                className="overflow-hidden rounded-lg border bg-[var(--bg-surface)]"
                style={{
                  borderColor: "var(--border-1)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
                  style={{ borderColor: "var(--border-1)" }}
                >
                  <div className="flex items-center gap-2">
                    <CalendarClock
                      className="size-4 text-[var(--brand-navy-700)]"
                      strokeWidth={1.75}
                    />
                    <h3 className="text-[13.5px] font-semibold text-[var(--fg-1)]">
                      Renouvellements
                    </h3>
                    <span
                      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                      style={{
                        background: "var(--brand-amber-50)",
                        color: "var(--brand-amber-800)",
                        border: "1px solid var(--brand-amber-200)",
                      }}
                    >
                      {renewals.length}
                    </span>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/courtier/contracts/renouvellements">
                      Voir tout
                    </Link>
                  </Button>
                </div>
                <ul
                  className="divide-y"
                  style={{ borderColor: "var(--border-1)" }}
                >
                  {topRenewals.map((contract) => {
                    const urgency = renewalUrgency(contract);
                    const tone = renewalUrgencyTone[urgency];
                    return (
                      <li key={contract.id}>
                        <Link
                          href={`/courtier/clients/${contract.client_id}/contracts/${contract.id}`}
                          className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[rgba(14,34,56,0.025)]"
                        >
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                            style={{
                              background: tone.bg,
                              border: `1px solid ${tone.bd}`,
                              color: tone.fg,
                            }}
                          >
                            <CalendarClock
                              className="size-4"
                              strokeWidth={1.75}
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                              {clientNames.get(contract.client_id) ?? "Client"}
                            </p>
                            <p className="truncate text-[12px] text-[var(--fg-3)]">
                              {contractDisplayLabel(contract)} ·{" "}
                              {formatContractPremium(contract)}
                            </p>
                          </div>
                          <span
                            className="shrink-0 font-mono text-[11.5px] font-medium"
                            style={{ color: tone.fg }}
                          >
                            {contract.renewal_date
                              ? formatDate(contract.renewal_date)
                              : "—"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            <ActivityFeed activity={activity} />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
