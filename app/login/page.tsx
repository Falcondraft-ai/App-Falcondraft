import Link from "next/link";
import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-[#f8f4ec]">
      <section className="grid min-h-dvh overflow-hidden bg-card lg:grid-cols-[minmax(21rem,38vw)_1fr]">
        <aside className="hidden bg-[#142033] p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex flex-col text-white transition-opacity hover:opacity-80"
              aria-label="FalconDraft"
            >
              <span className="text-2xl font-semibold tracking-[-0.055em]">
                FalconDraft
              </span>
              <span className="mt-1 text-xs font-medium tracking-[0.16em] text-white/46 uppercase">
                Espace client
              </span>
            </Link>
          </div>

          <div className="max-w-[18rem] border-l border-[#c18a45]/70 pl-4">
            <p className="text-[11px] font-medium tracking-[0.18em] text-white/56 uppercase">
              Accès privé
            </p>
            <p className="mt-3 text-2xl leading-tight font-semibold tracking-[-0.045em]">
              Connexion à votre espace FalconDraft.
            </p>
            <p className="mt-4 text-sm leading-6 text-white/62">
              Utilisateurs invités uniquement.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-white/12 pt-4 text-xs text-white/48">
            <span>Espace client</span>
            <span>FalconDraft</span>
          </div>
        </aside>

        <div className="flex min-h-dvh flex-col bg-[#f8f4ec]">
          <header className="flex h-20 items-center justify-between border-b px-5 sm:px-8">
            <Link
              href="/"
              className="flex items-center transition-opacity hover:opacity-80"
              aria-label="FalconDraft"
            >
              <Image
                src="/falcondraft-logo.png"
                alt="FalconDraft"
                width={363}
                height={384}
                className="h-10 w-auto object-contain"
                priority
              />
            </Link>
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Accueil
            </Link>
          </header>

          <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
            <div className="w-full max-w-[26rem]">
              <div className="mb-7">
                <p className="text-muted-foreground text-[11px] font-medium tracking-[0.16em] uppercase">
                  Connexion
                </p>
                <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-[-0.045em]">
                  Accéder à FalconDraft
                </h1>
              </div>

              <div className="border bg-card">
                <div className="border-b px-6 py-5">
                  <p className="text-sm font-medium">Compte professionnel</p>
                  <p className="text-muted-foreground mt-1 text-sm leading-6">
                    Connectez-vous pour rejoindre votre espace de travail.
                  </p>
                </div>

                <div className="px-6 py-6">
                  <LoginForm />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                <span>Accès réservé aux utilisateurs invités.</span>
                <span className="hidden sm:inline">FalconDraft</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
