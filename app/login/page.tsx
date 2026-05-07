import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/common/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[0.95fr_1.05fr]">
      <section className="hidden border-r bg-primary px-10 py-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <BrandMark
          href="/"
          size="lg"
          className="text-primary-foreground [&_[data-slot=brand-descriptor]]:text-primary-foreground/70"
        />
        <div className="max-w-xl">
          <p className="text-sm font-medium text-primary-foreground/72">
            FalconDraft
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-balance">
            Un espace de travail pour piloter chaque proposition jusqu’à l’envoi.
          </h1>
          <p className="mt-5 text-sm leading-7 text-primary-foreground/72">
            Les équipes commerciales gardent le contexte, les documents, la
            validation et les actions dans une même interface structurée.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/56">
          Espace de propositions · FalconDraft
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[25rem]">
          <div className="mb-8 lg:hidden">
            <BrandMark href="/" size="md" />
          </div>
          <div className="border bg-card p-6">
            <div className="mb-6">
              <p className="text-muted-foreground text-sm">Connexion</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
                Accéder à l’espace client
              </h1>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                Utilisez votre email professionnel pour retrouver vos
                opportunités et documents.
              </p>
            </div>

            <form action="/dashboard" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email professionnel</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="vous@entreprise.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password">Mot de passe</Label>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
                  >
                    Mot de passe oublié
                  </button>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>

              <Button type="submit" className="w-full" size="lg">
                Se connecter
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Button>
            </form>
          </div>
          <p className="text-muted-foreground mt-5 text-center text-xs">
            Besoin d’un accès ? Contactez votre administrateur FalconDraft.
          </p>
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Retour à l’accueil
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
