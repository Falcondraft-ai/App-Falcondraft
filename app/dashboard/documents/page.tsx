import { DocumentCard } from "@/components/common/document-card";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canUseOrganizationDataScope } from "@/lib/auth/workspace-permissions";
import { getDocumentsForOrganization } from "@/lib/data/supabase-app-data";
import type { MockDocument } from "@/types/document";

function DocumentsLibrary({
  documents,
  description,
}: {
  documents: MockDocument[];
  description: string;
}) {
  return (
    <section className="bg-card/75 rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Bibliothèque de travail</h2>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
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
  );
}

export default async function DocumentsPage() {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id ?? null;
  const access = {
    userId: context.user.id,
    role: context.membership?.role,
    allowMemberCompanyVisibility:
      context.organization?.allow_member_company_visibility ?? true,
  };
  const canOpenCompanyView = canUseOrganizationDataScope(
    access.role,
    access.allowMemberCompanyVisibility,
  );
  const [ownDocuments, companyDocuments] = await Promise.all([
    getDocumentsForOrganization(organizationId, {
      ...access,
      scope: "mine",
    }),
    canOpenCompanyView
      ? getDocumentsForOrganization(organizationId, {
          ...access,
          scope: "organization",
        })
      : Promise.resolve([]),
  ]);

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Documents"
          title="Documents générés"
          description="Propositions, devis, documents finaux et liens de signature associés aux dossiers commerciaux."
        />
        {canOpenCompanyView ? (
          <Tabs defaultValue="mine" className="gap-4">
            <TabsList>
              <TabsTrigger value="mine">Mes documents</TabsTrigger>
              <TabsTrigger value="organization">Toute l’entreprise</TabsTrigger>
            </TabsList>
            <TabsContent value="mine">
              <DocumentsLibrary
                documents={ownDocuments}
                description="Dernières pièces préparées pour vos dossiers."
              />
            </TabsContent>
            <TabsContent value="organization">
              <DocumentsLibrary
                documents={companyDocuments}
                description="Dernières pièces préparées pour tous les dossiers actifs."
              />
            </TabsContent>
          </Tabs>
        ) : (
          <DocumentsLibrary
            documents={ownDocuments}
            description="Dernières pièces préparées pour vos dossiers."
          />
        )}
      </div>
    </PageTransition>
  );
}
