import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/common/brand-mark";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";

const workflowSteps = [
  {
    label: "Opportunité",
    description: "Centraliser le contexte commercial et les notes d’échange.",
  },
  {
    label: "Proposition",
    description: "Structurer un document clair, relisible et maîtrisé.",
  },
  {
    label: "Validation",
    description: "Contrôler le fond, le chiffrage et la version finale.",
  },
  {
    label: "Envoi",
    description: "Préparer la signature, le PDF final et le message client.",
  },
] as const;

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-16">
        <section>
          <BrandMark size="lg" className="mb-10" />
          <p className="text-muted-foreground text-sm font-medium">
            Espace commercial premium
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
            Produire des propositions commerciales avec rigueur, vitesse et
            contrôle.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-base leading-7 sm:text-lg">
            FalconDraft organise le passage d’une opportunité qualifiée vers une
            proposition professionnelle, un document final validé et un envoi
            prêt pour le client.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/login">
                Accéder à FalconDraft
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/dashboard">Voir l’espace client</Link>
            </Button>
          </div>
        </section>

        <section className="border-l bg-card/70 p-5 lg:p-6">
          <div className="border-b pb-5">
            <p className="text-sm font-semibold">Flux de production</p>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              Un parcours conçu pour les équipes qui doivent produire des
              documents commerciaux précis, personnalisés et cohérents.
            </p>
          </div>
          <ol className="divide-y">
            {workflowSteps.map((step, index) => (
              <li
                key={step.label}
                className="grid grid-cols-[2.25rem_1fr] gap-4 py-5"
              >
                <span className="text-muted-foreground font-mono text-xs leading-6">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    {step.label}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-sm leading-6">
                    {step.description}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
