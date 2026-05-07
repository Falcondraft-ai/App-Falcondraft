import Link from "next/link";
import { BrandMark } from "@/components/common/brand-mark";
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
      <main className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
        <section className="flex flex-col justify-center">
          <BrandMark size="lg" />
          <p className="text-muted-foreground mt-8 text-sm font-medium tracking-[0.18em] uppercase">
            Espace client FalconDraft
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-[1.02] font-semibold tracking-[-0.055em] text-balance sm:text-6xl">
            Le poste de travail des propositions commerciales exigeantes.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-base leading-7 sm:text-lg">
            FalconDraft organise le passage d’un dossier qualifié à une
            proposition professionnelle, validée puis prête à être envoyée.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/login">Se connecter</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/dashboard">Accéder à l’espace client</Link>
            </Button>
          </div>
        </section>

        <section className="self-center border bg-card">
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
