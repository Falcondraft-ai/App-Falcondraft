import { IntroducerManager } from "@/components/broker/introducer-manager";
import { IntroducerModuleToggle } from "@/components/broker/introducer-module-toggle";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import {
  canCreateWorkspaceRecords,
  canManageWorkspace,
} from "@/lib/auth/workspace-permissions";
import { getBrokerCommissions, getBrokerIntroducers } from "@/lib/broker/data";
import { parseBrokerSettings } from "@/lib/broker/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CourtierIntroducersPage() {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;
  const settings = parseBrokerSettings(context.organization);
  const canEdit = canCreateWorkspaceRecords(context.membership?.role);
  const canManage = canManageWorkspace(context.membership?.role);

  let introducers: Awaited<ReturnType<typeof getBrokerIntroducers>> = [];
  let commissions: Awaited<ReturnType<typeof getBrokerCommissions>> = [];
  if (settings.introducersEnabled) {
    [introducers, commissions] = await Promise.all([
      getBrokerIntroducers(organizationId),
      getBrokerCommissions(organizationId, { limit: 5000 }),
    ]);
  }

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

      <IntroducerModuleToggle
        initialEnabled={settings.introducersEnabled}
        canEdit={canManage}
      />

      {settings.introducersEnabled ? (
        <IntroducerManager
          introducers={introducers}
          owedByIntroducer={owedByIntroducer}
          canEdit={canEdit}
        />
      ) : (
        <p
          className="rounded-lg border bg-[var(--bg-surface)] px-4 py-6 text-center text-[13px] text-[var(--fg-3)]"
          style={{ borderColor: "var(--border-1)" }}
        >
          Module désactivé. Activez-le ci-dessus pour gérer vos apporteurs
          d’affaires et leurs rétrocessions.
        </p>
      )}
    </div>
  );
}
