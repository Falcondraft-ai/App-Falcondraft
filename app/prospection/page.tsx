import { PageTransition } from "@/components/common/page-transition";
import { ProspectionPage } from "@/components/prospection/prospection-page";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canAccessProspection } from "@/lib/internal-access";
import {
  getProspectCompanies,
  getProspectingSearches,
} from "@/lib/prospection/data";

export default async function ProspectionRoute() {
  const context = await requireCurrentUserContext();

  if (!canAccessProspection(context)) {
    return null;
  }

  const organizationId = context.organization?.id;
  if (!organizationId) return null;

  const [companies, searches] = await Promise.all([
    getProspectCompanies(organizationId),
    getProspectingSearches(organizationId),
  ]);

  return (
    <PageTransition>
      <ProspectionPage
        initialCompanies={companies}
        initialSearches={searches}
      />
    </PageTransition>
  );
}
