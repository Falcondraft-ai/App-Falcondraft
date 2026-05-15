"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/common/brand-mark";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { T } from "@/components/i18n/translated-text";

export function AuthShell({
  eyebrow,
  title,
  cardTitle,
  cardDescription,
  footer,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  cardTitle: ReactNode;
  cardDescription: ReactNode;
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
    <main className="bg-background text-foreground min-h-dvh">
      <section className="bg-card grid min-h-dvh overflow-hidden lg:grid-cols-[minmax(18rem,32vw)_1fr]">
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
                <T tx="auth.shell.clientWorkspace" />
              </span>
            </Link>
          </div>

          <div className="max-w-[22rem] border-l border-[#c18a45]/75 pl-5">
            <p className="text-xs font-medium tracking-[0.18em] text-white/58 uppercase">
              <T tx="auth.shell.privateAccess" />
            </p>
            <p className="mt-4 text-4xl leading-[1.02] font-semibold tracking-[-0.06em] xl:text-[2.65rem]">
              <T tx="auth.shell.privateTitle" />
            </p>
            <p className="mt-5 text-base leading-7 text-white/66">
              <T tx="auth.shell.privateDescription" />
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-white/12 pt-4 text-xs text-white/48">
            <span>
              <T tx="auth.shell.clientWorkspace" />
            </span>
            <span>FalconDraft</span>
          </div>
        </aside>

        <div className="bg-background flex min-h-dvh flex-col">
          <header className="flex h-20 items-center justify-between border-b px-5 sm:px-8 lg:h-24">
            <BrandMark href="/" size="md" showDescriptor={false} />
            <div className="flex items-center gap-3">
              <LanguageSelector triggerClassName="h-9 w-[8.5rem]" />
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              >
                <T tx="auth.shell.home" />
              </Link>
            </div>
          </header>

          <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:py-12">
            <motion.div className="w-full max-w-[28rem]" {...formMotionProps}>
              <div className="mb-7">
                <p className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
                  {eyebrow}
                </p>
                <h1 className="mt-2 text-4xl leading-tight font-semibold tracking-[-0.055em]">
                  {title}
                </h1>
              </div>

              <div className="bg-card overflow-hidden rounded-2xl border shadow-[0_18px_55px_-45px_rgba(20,32,51,0.55)]">
                <div className="border-b px-7 py-5">
                  <p className="text-base font-medium">{cardTitle}</p>
                  <p className="text-muted-foreground mt-1 text-sm leading-6">
                    {cardDescription}
                  </p>
                </div>

                <div className="px-7 py-7">{children}</div>
              </div>

              <div className="text-muted-foreground mt-5 flex items-center justify-between gap-4 text-xs">
                {footer}
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  );
}
