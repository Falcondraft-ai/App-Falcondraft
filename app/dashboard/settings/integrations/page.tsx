import { IntegrationCard } from "@/components/common/integration-card";
import { PageTransition } from "@/components/common/page-transition";
import { mockIntegrations } from "@/data/mock-team";

export default function IntegrationsSettingsPage() {
  return (
    <PageTransition>
      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Intégrations</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Connexions métier utilisées pour finaliser le parcours commercial.
          </p>
        </div>
        <div>
          {mockIntegrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
      </section>
    </PageTransition>
  );
}
