import { DocumentCard } from "@/components/common/document-card";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { mockDocuments } from "@/data/mock-documents";

export default function DocumentsPage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Documents"
          title="Documents générés"
          description="Propositions, devis, documents finaux et liens de signature associés aux opportunités."
        />
        <section className="border bg-card/75">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Bibliothèque de travail</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Dernières pièces préparées pour les opportunités actives.
            </p>
          </div>
          <div>
            {mockDocuments.map((document) => (
              <DocumentCard key={document.id} document={document} />
            ))}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
