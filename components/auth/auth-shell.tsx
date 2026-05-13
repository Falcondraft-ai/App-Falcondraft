"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  eyebrow,
  title,
  cardTitle,
  cardDescription,
  footer,
  children,
}: {
  eyebrow: string;
  title: string;
  cardTitle: string;
  cardDescription: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();
  const formMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <main className="min-h-dvh bg-[#f8f4ec]">
      <section className="grid min-h-dvh overflow-hidden bg-card lg:grid-cols-[minmax(18rem,32vw)_1fr]">
        <aside className="hidden bg-[#142033] p-9 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex flex-col text-white transition-opacity hover:opacity-80"
              aria-label="FalconDraft"
            >
              <span className="text-3xl font-semibold tracking-[-0.055em]">
                FalconDraft
              </span>
              <span className="mt-1.5 text-xs font-medium tracking-[0.16em] text-white/50 uppercase">
                Espace client
              </span>
            </Link>
          </div>

          <div className="max-w-[22rem] border-l border-[#c18a45]/75 pl-5">
            <p className="text-xs font-medium tracking-[0.18em] text-white/58 uppercase">
              Accès privé
            </p>
            <p className="mt-4 text-4xl leading-[1.02] font-semibold tracking-[-0.06em] xl:text-[2.65rem]">
              Connexion à votre espace FalconDraft.
            </p>
            <p className="mt-5 text-base leading-7 text-white/66">
              Un accès sécurisé pour suivre les dossiers, documents et validations de votre espace client.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-white/12 pt-4 text-xs text-white/48">
            <span>Espace client</span>
            <span>FalconDraft</span>
          </div>
        </aside>

        <div className="flex min-h-dvh flex-col bg-[#f8f4ec]">
          <header className="flex h-20 items-center justify-between border-b px-5 sm:px-8 lg:h-24">
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
                className="h-12 w-auto object-contain lg:h-14"
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

          <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:py-12">
            <motion.div
              className="w-full max-w-[28rem]"
              {...formMotionProps}
            >
              <div className="mb-7">
                <p className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
                  {eyebrow}
                </p>
                <h1 className="mt-2 text-4xl leading-tight font-semibold tracking-[-0.055em]">
                  {title}
                </h1>
              </div>

              <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_18px_55px_-45px_rgba(20,32,51,0.55)]">
                <div className="border-b px-7 py-5">
                  <p className="text-base font-medium">{cardTitle}</p>
                  <p className="text-muted-foreground mt-1 text-sm leading-6">
                    {cardDescription}
                  </p>
                </div>

                <div className="px-7 py-7">{children}</div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                {footer}
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  );
}
