import { Inbox, MailSearch } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { DigestBackfillMenu } from "@/components/broker/digest-backfill-menu";
import { GenerateDigestButton } from "@/components/broker/generate-digest-button";
import { OutlookConnectionCard } from "@/components/broker/outlook-connection-card";
import { OutlookDigest } from "@/components/broker/outlook-digest";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { BROKER_OFFERING_CUSTOM, getBrokerOffering } from "@/lib/broker/access";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import {
  getBrokerClients,
  getEmailDigestDetail,
  getLatestEmailDigest,
} from "@/lib/broker/data";
import { getOutlookConnectionForUser } from "@/lib/email/connections";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CourtierInboxPage() {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;
  const userId = context.user.id;

  const connection = await getOutlookConnectionForUser({
    organizationId,
    userId,
  });
  const connected = connection?.status === "connected";
  // Sur mesure : pas de briefing automatique le matin — le courtier le lance
  // lui-même depuis cette page (et « Remonter » rattrape les jours sautés).
  const autoDaily =
    getBrokerOffering(context.organization) !== BROKER_OFFERING_CUSTOM;

  if (!connected) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <PageHeader
            title="Assistant Outlook"
            description={
              autoDaily
                ? "Connectez votre boîte Outlook pour recevoir, chaque jour, un briefing trié de vos emails de courtage."
                : "Connectez votre boîte Outlook pour obtenir, quand vous le lancez, un briefing trié de vos emails de courtage."
            }
          />
          <div className="max-w-2xl">
            <OutlookConnectionCard initialConnection={connection} />
          </div>
        </div>
      </PageTransition>
    );
  }

  const digest = await getLatestEmailDigest(organizationId, userId);

  if (!digest) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <PageHeader
            title="Assistant Outlook"
            description="Votre boîte Outlook est connectée. Générez votre premier briefing."
          />
          <div
            className="rounded-xl border bg-[var(--bg-surface)] p-8 text-center"
            style={{
              borderColor: "var(--border-1)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <span
              className="mx-auto flex size-12 items-center justify-center rounded-full"
              style={{
                background: "var(--brand-navy-50)",
                color: "var(--brand-navy-700)",
                border: "1px solid var(--border-1)",
              }}
            >
              <MailSearch className="size-6" strokeWidth={1.5} />
            </span>
            <h2 className="mt-4 text-[16px] font-semibold text-[var(--fg-1)]">
              Prêt à analyser votre boîte
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-6 text-[var(--fg-3)]">
              FalconDraft lit vos emails récents, écarte tout ce qui ne concerne
              pas le courtage, résume l’essentiel et vous propose les bonnes
              actions — que vous validez une par une.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <GenerateDigestButton />
              <DigestBackfillMenu />
            </div>
            <p className="mx-auto mt-3 max-w-md text-[11.5px] text-[var(--fg-4)]">
              « Remonter » analyse aussi les emails plus anciens non encore
              traités (jusqu’à 90 jours).
            </p>
          </div>
        </div>
      </PageTransition>
    );
  }

  const { items, suggestions } = await getEmailDigestDetail(
    organizationId,
    digest.id,
  );
  const clients = await getBrokerClients(organizationId, {
    limit: 2000,
    includeArchived: true,
  });
  const clientNames: Record<string, string> = {};
  for (const c of clients) clientNames[c.id] = brokerClientDisplayName(c);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PageHeader
            title="Assistant Outlook"
            description={
              autoDaily
                ? "Votre briefing du jour, trié et prêt à traiter."
                : "Votre dernier briefing, trié et prêt à traiter."
            }
          />
          {connection?.email ? (
            <span
              className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] sm:inline-flex"
              style={{
                color: "var(--fg-2)",
                borderColor: "var(--border-1)",
                background: "var(--bg-surface)",
              }}
              title="Toutes les adresses regroupées dans cette boîte Outlook sont analysées."
            >
              <Inbox className="size-3.5" strokeWidth={1.75} />
              {connection.email}
              <span className="text-[var(--fg-4)]">· toutes adresses</span>
            </span>
          ) : null}
        </div>

        <OutlookDigest
          digest={digest}
          items={items}
          suggestions={suggestions}
          clientNames={clientNames}
        />
      </div>
    </PageTransition>
  );
}
