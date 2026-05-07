import { DocumentCard } from "@/components/common/document-card";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getDocumentsForOrganization } from "@/lib/data/supabase-app-data";

export default async function DocumentsPage() {
  const context = await requireCurrentUserContext();
  const documents = await getDocumentsForOrganization(
    context.organization?.id ?? null,
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Documents"
          title="Documents générés"
          description="Propositions, devis, documents finaux et liens de signature associés aux dossiers commerciaux."
        />
        <section className="border bg-card/75">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Bibliothèque de travail</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Dernières pièces préparées pour les dossiers actifs.
            </p>
          </div>
          <div>
            {documents.length > 0 ? (
              documents.map((document) => (
                <DocumentCard key={document.id} document={document} />
              ))
            ) : (
              <div className="p-4">
                <EmptyState
                  title="Aucun document"
                  description="Les documents apparaîtront ici dès qu’ils seront préparés pour un dossier commercial."
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
