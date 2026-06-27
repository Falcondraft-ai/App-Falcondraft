import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageTransition } from "@/components/common/page-transition";
import { CommissionImporter } from "@/components/broker/commission-importer";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import { contractDisplayLabel } from "@/lib/broker/contracts";
import { getBrokerClients, getBrokerContracts } from "@/lib/broker/data";
import { parseBrokerSettings } from "@/lib/broker/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BrokerCommissionImportPage() {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;
  const canEdit = canCreateWorkspaceRecords(context.membership?.role);

  const [clients, contracts] = await Promise.all([
    getBrokerClients(organizationId, { limit: 2000, includeArchived: true }),
    getBrokerContracts(organizationId, { limit: 2000 }),
  ]);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: brokerClientDisplayName(c),
  }));
  const contractOptions = contracts.map((c) => ({
    id: c.id,
    clientId: c.client_id,
    label: contractDisplayLabel(c),
  }));
  const insurers = parseBrokerSettings(context.organization).partnerInsurers;

  return (
    <PageTransition>
      <div className="space-y-5">
        <nav
          className="flex flex-wrap items-center gap-1.5 text-[12px]"
          style={{ color: "var(--fg-3)" }}
          aria-label="Breadcrumb"
        >
          <Link href="/courtier/commissions" className="hover:text-[var(--fg-1)]">
            Commissions
          </Link>
          <ChevronRight className="size-3" strokeWidth={2} aria-hidden="true" />
          <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>
            Importer un bordereau
          </span>
        </nav>

        <div>
          <p className="fd-eyebrow mb-2">Pointage assisté</p>
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--fg-1)]">
            Importer un bordereau
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--fg-2)]">
            Déposez le relevé de commissions de la compagnie. L’IA en extrait les
            lignes et les rattache à vos dossiers ; vous vérifiez et corrigez avant
            l’enregistrement. Le fichier d’origine est archivé avec le bordereau.
          </p>
        </div>

        {canEdit ? (
          <CommissionImporter
            clients={clientOptions}
            contracts={contractOptions}
            insurers={insurers}
          />
        ) : (
          <div
            className="rounded-lg border p-5 text-[13px] text-[var(--fg-3)]"
            style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}
          >
            Votre rôle ne permet pas d’importer un bordereau.
          </div>
        )}
      </div>
    </PageTransition>
  );
}
