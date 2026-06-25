import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PageTransition } from "@/components/common/page-transition";
import { ContractForm } from "@/components/broker/contract-form";
import { ContractStatusBadge } from "@/components/broker/contract-status-badge";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import { contractDisplayLabel } from "@/lib/broker/contracts";
import { getBrokerClient, getBrokerContract } from "@/lib/broker/data";
import { parseBrokerSettings } from "@/lib/broker/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BrokerContractEditPage({
  params,
}: {
  params: Promise<{ id: string; contractId: string }>;
}) {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;
  const { id, contractId } = await params;

  const [client, contract] = await Promise.all([
    getBrokerClient(organizationId, id),
    getBrokerContract(organizationId, contractId),
  ]);

  if (!client || !contract || contract.client_id !== client.id) {
    notFound();
  }

  const displayName = brokerClientDisplayName(client);
  const canEdit = canCreateWorkspaceRecords(context.membership?.role);
  const brokerSettings = parseBrokerSettings(context.organization);

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
          <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>Contrat</span>
        </nav>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="fd-eyebrow mb-2">Contrat</p>
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--fg-1)]">
              {contractDisplayLabel(contract)}
            </h1>
          </div>
          <ContractStatusBadge status={contract.status} />
        </div>

        <section
          className="rounded-lg border bg-[var(--bg-surface)] p-5"
          style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
        >
          <ContractForm
            clientId={client.id}
            contract={contract}
            branches={brokerSettings.enabledBranches}
            insurers={brokerSettings.partnerInsurers}
            canEdit={canEdit}
            mode="edit"
          />
        </section>
      </div>
    </PageTransition>
  );
}
