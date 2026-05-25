import type { ReactNode } from "react";
import { T } from "@/components/i18n/translated-text";

export function ComingSoonPanel({
  icon,
  title,
  description,
  features,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  features?: ReactNode[];
}) {
  return (
    <section
      className="mx-auto max-w-2xl rounded-lg border bg-[var(--bg-surface)] px-8 py-12 text-center"
      style={{
        borderColor: "var(--border-1)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl"
        style={{
          background: "var(--brand-navy-50)",
          border: "1px solid var(--brand-navy-100)",
          color: "var(--brand-navy-700)",
        }}
      >
        {icon}
      </div>
      <span
        className="mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{
          background: "var(--brand-amber-50)",
          color: "var(--brand-amber-800)",
          border: "1px solid var(--brand-amber-200)",
        }}
      >
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--brand-amber-500)" }}
        />
        <T tx="common.comingSoon.badge" />
      </span>
      <h1 className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.015em] text-[var(--fg-1)]">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-[14px] leading-6 text-[var(--fg-3)]">
        {description ?? <T tx="common.comingSoon.description" />}
      </p>
      {features && features.length > 0 ? (
        <ul className="mx-auto mt-7 grid max-w-md gap-2.5 text-left">
          {features.map((feature, index) => (
            <li
              key={index}
              className="flex items-start gap-3 rounded-md border px-4 py-3 text-[13px] leading-5 text-[var(--fg-2)]"
              style={{
                borderColor: "var(--border-1)",
                background: "var(--brand-navy-50)",
              }}
            >
              <span
                aria-hidden
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--brand-amber-500)" }}
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="fd-meta mt-7 font-mono text-[11px] tracking-[0.06em] uppercase">
        FalconDraft · v3 · feuille de route 2026
      </p>
    </section>
  );
}
