import Link from "next/link";
import { FoundationShowcase } from "@/components/common/foundation-showcase";
import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { foundationPillars } from "@/data/foundation";

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <section className="flex flex-col justify-center">
          <Badge variant="secondary" className="mb-6 w-fit">
            Fondation technique
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            FalconDraft prépare la production commerciale premium.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
            Cette première étape installe un socle propre pour créer un deal,
            générer une proposition professionnelle, la valider puis l’envoyer
            avec confiance.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/dashboard">Voir le dashboard</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Tester la page de connexion</Link>
            </Button>
          </div>
        </section>

        <FoundationShowcase />
      </main>

      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <Separator className="mb-8" />
        <div className="grid gap-4 md:grid-cols-4">
          {foundationPillars.map((pillar) => (
            <Card key={pillar.title} className="bg-card/70">
              <CardContent className="pt-6">
                <pillar.icon
                  className="text-primary mb-4 size-5"
                  aria-hidden="true"
                />
                <h2 className="text-sm font-semibold">{pillar.title}</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {pillar.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
