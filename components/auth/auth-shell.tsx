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
  const cardMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: {
          opacity: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const },
          y: {
            type: "spring" as const,
            stiffness: 260,
            damping: 28,
            mass: 0.7,
          },
        },
      };

  return (
    <main className="bg-background text-foreground min-h-dvh">
      <section className="grid min-h-dvh overflow-hidden lg:grid-cols-[minmax(20rem,34vw)_1fr]">
        <aside className="hidden bg-[#0E2238] p-9 text-white lg:flex lg:flex-col lg:justify-between">
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

          <div className="max-w-[22rem] border-l border-[var(--accent)]/75 pl-5">
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

        <div
          className="relative flex min-h-dvh flex-col bg-background"
          style={{
            background:
              "radial-gradient(120% 80% at 50% -10%, var(--brand-navy-50) 0%, var(--background) 60%, var(--background) 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(11,18,32,0.04) 1px, transparent 0)",
              backgroundSize: "24px 24px",
              maskImage:
                "radial-gradient(ellipse 90% 70% at 50% 30%, black 30%, transparent 80%)",
            }}
          />

          <header className="relative z-10 flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 sm:h-20 sm:px-8 lg:h-24 lg:border-b-0">
            <div className="lg:invisible">
              <BrandMark href="/" size="md" showDescriptor={false} />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSelector triggerClassName="h-9 w-[7.5rem] sm:w-[8.5rem]" />
              <Link
                href="/"
                className="hidden text-sm font-medium text-[var(--fg-3)] transition-colors hover:text-[var(--fg-1)] sm:inline"
              >
                <T tx="auth.shell.home" />
              </Link>
            </div>
          </header>

          <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10 sm:px-6 sm:pb-12">
            <motion.div
              className="w-full max-w-[26rem]"
              {...cardMotionProps}
            >
              <div className="mb-7 text-center">
                <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.035em] text-[var(--fg-1)] sm:text-[32px] sm:tracking-[-0.045em] md:text-[38px]">
                  {title}
                </h1>
              </div>

              <div
                className="overflow-hidden rounded-2xl border bg-white"
                style={{
                  borderColor: "var(--border-1)",
                  boxShadow:
                    "0 1px 2px rgba(11,18,32,0.04), 0 18px 60px -30px rgba(14,34,56,0.22)",
                }}
              >
                <div
                  className="border-b px-6 py-5 sm:px-7"
                  style={{ borderColor: "var(--border-1)" }}
                >
                  <p className="text-[15px] font-semibold text-[var(--fg-1)]">
                    {cardTitle}
                  </p>
                  <p className="mt-1 text-[13px] leading-6 text-[var(--fg-3)]">
                    {cardDescription}
                  </p>
                </div>
                <div className="px-6 py-6 sm:px-7 sm:py-7">{children}</div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-[12px] text-[var(--fg-3)]">
                {footer}
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  );
}
