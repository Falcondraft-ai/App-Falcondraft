import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { NewClientForm } from "@/components/broker/new-client-form";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/common/page-transition";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { parseBrokerSettings } from "@/lib/broker/settings";

export const dynamic = "force-dynamic";

export default async function NewBrokerClientPage() {
  const context = await requireActiveWorkspaceContext();
  const settings = parseBrokerSettings(context.organization);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-5">
        <nav
          className="flex items-center gap-1.5 text-[12px]"
          style={{ color: "var(--fg-3)" }}
          aria-label="Breadcrumb"
        >
          <Link href="/courtier/clients" className="hover:text-[var(--fg-1)]">
            Dossiers clients
          </Link>
          <ChevronRight className="size-3" strokeWidth={2} aria-hidden="true" />
          <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>
            Nouveau dossier
          </span>
        </nav>

        <PageHeader
          eyebrow="Dossier client"
          title="Créer un dossier client"
          description="Renseignez les informations du client et sa branche. Vous pourrez ensuite ajouter ses documents et générer son devoir de conseil."
          actions={
            <Button asChild variant="ghost">
              <Link
                href="/courtier/import"
                className="inline-flex items-center gap-1.5"
              >
                <FileText className="size-3.5" strokeWidth={2} />
                À partir d’un document
              </Link>
            </Button>
          }
        />

        <NewClientForm branches={settings.enabledBranches} />
      </div>
    </PageTransition>
  );
}
