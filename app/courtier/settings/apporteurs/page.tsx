import { IntroducerManager } from "@/components/broker/introducer-manager";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { getBrokerCommissions, getBrokerIntroducers } from "@/lib/broker/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CourtierIntroducersPage() {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;
  const canEdit = canCreateWorkspaceRecords(context.membership?.role);

  const [introducers, commissions] = await Promise.all([
    getBrokerIntroducers(organizationId),
    getBrokerCommissions(organizationId, { limit: 5000 }),
  ]);

  // Relevé: total retrocession owed per introducer.
  const owedByIntroducer: Record<string, number> = {};
  for (const line of commissions) {
    if (!line.introducer_id) continue;
    owedByIntroducer[line.introducer_id] =
      (owedByIntroducer[line.introducer_id] ?? 0) +
      (line.retrocession_amount ?? 0);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--fg-1)]">
          Apporteurs
        </h2>
        <p className="mt-0.5 max-w-2xl text-[12.5px] leading-5 text-[var(--fg-3)]">
          Vos apporteurs d’affaires et leur taux de rétrocession. Le taux
          s’applique automatiquement aux commissions des clients qu’ils vous ont
          amenés ; le total dû à chacun se met à jour ici.
        </p>
      </div>
      <IntroducerManager
        introducers={introducers}
        owedByIntroducer={owedByIntroducer}
        canEdit={canEdit}
      />
    </div>
  );
}
