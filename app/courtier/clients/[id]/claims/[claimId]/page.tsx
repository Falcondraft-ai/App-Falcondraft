import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PageTransition } from "@/components/common/page-transition";
import { ClaimForm } from "@/components/broker/claim-form";
import { ClaimStatusBadge } from "@/components/broker/claim-status-badge";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import { claimDisplayLabel } from "@/lib/broker/claims";
import { contractDisplayLabel } from "@/lib/broker/contracts";
import {
  getBrokerClaim,
  getBrokerClient,
  getBrokerClientContracts,
} from "@/lib/broker/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BrokerClaimEditPage({
  params,
}: {
  params: Promise<{ id: string; claimId: string }>;
}) {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;
  const { id, claimId } = await params;

  const [client, claim, contracts] = await Promise.all([
    getBrokerClient(organizationId, id),
    getBrokerClaim(organizationId, claimId),
    getBrokerClientContracts(organizationId, id),
  ]);

  if (!client || !claim || claim.client_id !== client.id) {
    notFound();
  }

  const displayName = brokerClientDisplayName(client);
  const canEdit = canCreateWorkspaceRecords(context.membership?.role);
  const contractOptions = contracts.map((c) => ({
    id: c.id,
    label: contractDisplayLabel(c),
  }));

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-5">
        <nav
          className="flex flex-wrap items-center gap-1.5 text-[12px]"
          style={{ color: "var(--fg-3)" }}
          aria-label="Breadcrumb"
        >
          <Link href="/courtier/clients" className="hover:text-[var(--fg-1)]">
            Dossiers clients
          </Link>
          <ChevronRight className="size-3" strokeWidth={2} aria-hidden="true" />
          <Link
            href={`/courtier/clients/${client.id}`}
            className="hover:text-[var(--fg-1)]"
          >
            {displayName}
          </Link>
          <ChevronRight className="size-3" strokeWidth={2} aria-hidden="true" />
          <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>Sinistre</span>
        </nav>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="fd-eyebrow mb-2">Sinistre</p>
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--fg-1)]">
              {claimDisplayLabel(claim)}
            </h1>
          </div>
          <ClaimStatusBadge status={claim.status} />
        </div>

        <section
          className="rounded-lg border bg-[var(--bg-surface)] p-5"
          style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
        >
          <ClaimForm
            clientId={client.id}
            claim={claim}
            contracts={contractOptions}
            canEdit={canEdit}
            mode="edit"
          />
        </section>
      </div>
    </PageTransition>
  );
}
