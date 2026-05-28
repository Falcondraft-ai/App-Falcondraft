"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[#f7f4ef] px-6 text-[#1c1917]">
          <section className="max-w-lg rounded-[2rem] border border-[#ded6ca] bg-white p-8 shadow-[0_24px_80px_rgba(28,25,23,0.08)]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6a3e]">
              FalconDraft
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">
              Une erreur est survenue.
            </h1>
            <p className="mt-4 text-sm leading-6 text-[#6b6259]">
              L’interface n’a pas pu être affichée correctement. Notre équipe
              technique peut analyser l’incident si le suivi Sentry est activé.
            </p>
            <a
              href="/dashboard"
              className="mt-6 inline-flex rounded-full bg-[#1c1917] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#3a332d]"
            >
              Revenir au tableau de bord
            </a>
          </section>
        </main>
      </body>
    </html>
  );
}
