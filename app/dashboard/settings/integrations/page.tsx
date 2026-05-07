import { IntegrationCard } from "@/components/common/integration-card";
import { EmptyState } from "@/components/common/empty-state";
import { PageTransition } from "@/components/common/page-transition";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getIntegrationsForOrganization } from "@/lib/data/supabase-app-data";

export default async function IntegrationsSettingsPage() {
  const context = await requireCurrentUserContext();
  const integrations = await getIntegrationsForOrganization(
    context.organization?.id ?? null,
  );

  return (
    <PageTransition>
      <section className="border bg-card/80">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Intégrations</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Connexions métier utilisées pour finaliser le parcours commercial.
          </p>
        </div>
        <div>
          {integrations.length > 0 ? (
            integrations.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))
          ) : (
            <div className="p-4">
              <EmptyState
                title="Aucune intégration"
                description="Les connexions configurées pour cet espace client seront listées ici."
              />
            </div>
          )}
        </div>
      </section>
    </PageTransition>
  );
}
