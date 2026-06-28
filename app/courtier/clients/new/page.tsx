import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { NewClientForm } from "@/components/broker/new-client-form";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { getBrokerIntroducers } from "@/lib/broker/data";
import { parseBrokerSettings } from "@/lib/broker/settings";

export const dynamic = "force-dynamic";

export default async function NewBrokerClientPage() {
  const context = await requireActiveWorkspaceContext();
  const settings = parseBrokerSettings(context.organization);
  const introducers = settings.introducersEnabled
    ? await getBrokerIntroducers(context.organization!.id)
    : [];

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
          description="Renseignez les informations du client et son besoin. Vous pourrez ensuite ajouter ses documents et générer son devoir de conseil."
        />

        <NewClientForm
          branches={settings.enabledBranches}
          introducers={introducers.map((i) => ({ id: i.id, name: i.name }))}
        />
      </div>
    </PageTransition>
  );
}
