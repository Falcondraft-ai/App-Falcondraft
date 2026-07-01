import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { ImportWizard } from "@/components/broker/import-wizard";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { computeStorageUsage } from "@/lib/broker/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BrokerImportPage() {
  const context = await requireActiveWorkspaceContext();
  const canEdit = canCreateWorkspaceRecords(context.membership?.role);
  const usage = computeStorageUsage(context.organization);

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Reprise de données"
          title="Importer des clients"
          description="Déposez un dossier entier ou un .zip, même mal rangé. L’assistant identifie chaque client, regroupe les pièces et vous propose des dossiers prêts à créer — vous validez, il range tout."
        />

        {canEdit ? (
          <ImportWizard storageFull={usage.isFull} />
        ) : (
          <div
            className="rounded-lg border p-5 text-[13px]"
            style={{
              borderColor: "var(--border-1)",
              background: "var(--bg-surface)",
              color: "var(--fg-3)",
            }}
          >
            Votre rôle ne permet pas d’importer des clients. Demandez à un
            gestionnaire de votre cabinet.
          </div>
        )}
      </div>
    </PageTransition>
  );
}
