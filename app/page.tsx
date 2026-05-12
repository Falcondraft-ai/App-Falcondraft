import Link from "next/link";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";

const operatingSteps = [
  {
    label: "Dossier commercial",
    detail: "Centraliser le contexte client, les contraintes et le besoin.",
  },
  {
    label: "Proposition",
    detail: "Structurer une réponse commerciale claire et relisible.",
  },
  {
    label: "Validation",
    detail: "Contrôler le contenu avant document final et envoi.",
  },
  {
    label: "Envoi",
    detail: "Préparer signature, PDF final et brouillon email.",
  },
] as const;

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto grid min-h-[calc(100vh-4.5rem)] w-full max-w-6xl items-center gap-16 px-4 py-24 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-20 lg:py-28">
        <section className="flex max-w-3xl flex-col justify-center">
          <p className="text-muted-foreground text-sm font-medium tracking-[0.18em] uppercase">
            Espace client
          </p>
          <h1 className="mt-8 text-4xl leading-[1.06] font-semibold tracking-[-0.055em] text-balance sm:text-6xl">
            Piloter vos dossiers commerciaux jusqu’à l’envoi.
          </h1>
          <p className="text-muted-foreground mt-10 max-w-2xl text-base leading-8 sm:text-lg">
            FalconDraft organise le passage d’un dossier qualifié à une
            proposition professionnelle, validée puis prête à être envoyée.
          </p>
          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/login">Se connecter</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a
                href="https://falcondraft.fr"
                target="_blank"
                rel="noreferrer"
              >
                Découvrir la solution
              </a>
            </Button>
          </div>
        </section>

        <section className="self-center rounded-lg border bg-card">
          <div className="grid grid-cols-[6px_1fr] border-b">
            <div className="bg-primary" aria-hidden="true" />
            <div className="px-5 py-4">
              <p className="text-sm font-semibold">Chaîne de production</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Un flux clair pour garder la proposition sous contrôle.
              </p>
            </div>
          </div>
          <ol className="divide-y">
            {operatingSteps.map((step, index) => (
              <li
                key={step.label}
                className="grid grid-cols-[4.25rem_1fr] items-start"
              >
                <span className="border-r px-5 py-5 font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="px-5 py-4">
                  <span className="block text-sm font-semibold">
                    {step.label}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-sm leading-6">
                    {step.detail}
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
