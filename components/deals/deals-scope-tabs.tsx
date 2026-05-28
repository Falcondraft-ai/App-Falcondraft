"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DealsTable } from "@/components/deals/deals-table";
import { useI18n } from "@/components/i18n/language-provider";
import type { Deal } from "@/types/deal";

type Scope = "mine" | "organization";

export function DealsScopeTabs({
  ownDeals,
  companyDeals,
  initialScope = "mine",
}: {
  ownDeals: Deal[];
  companyDeals: Deal[];
  initialScope?: Scope;
}) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const [scope, setScope] = React.useState<Scope>(initialScope);
  const [previousScope, setPreviousScope] = React.useState<Scope>(initialScope);

  React.useEffect(() => {
    setScope(initialScope);
  }, [initialScope]);

  const direction: 1 | -1 =
    scope === "organization" && previousScope === "mine"
      ? 1
      : scope === "mine" && previousScope === "organization"
        ? -1
        : 1;

  React.useEffect(() => {
    setPreviousScope(scope);
  }, [scope]);

  const deals = scope === "mine" ? ownDeals : companyDeals;

  const tabs: { value: Scope; label: string }[] = [
    { value: "mine", label: t("deals.tabs.mine") },
    { value: "organization", label: t("deals.tabs.organization") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Périmètre des dossiers"
        className="relative flex h-10 items-end gap-6 border-b"
        style={{ borderColor: "var(--border-1)" }}
      >
        {tabs.map((tab) => {
          const active = tab.value === scope;
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setScope(tab.value)}
              className="relative h-9 px-0 text-[13.5px] transition-colors duration-150"
              style={{
                color: active ? "var(--fg-1)" : "var(--fg-3)",
                fontWeight: active ? 600 : 500,
              }}
            >
              <span>{tab.label}</span>
              {active ? (
                <motion.span
                  layoutId="deals-scope-underline"
                  className="absolute left-0 -bottom-px h-[2px] w-full rounded-full"
                  style={{ background: "var(--accent)" }}
                  transition={{
                    type: "spring",
                    stiffness: 360,
                    damping: 32,
                    mass: 0.6,
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={scope}
            initial={
              reduceMotion
                ? { opacity: 1 }
                : { opacity: 0, x: direction * 32, filter: "blur(4px)" }
            }
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={
              reduceMotion
                ? { opacity: 1 }
                : {
                    opacity: 0,
                    x: direction * -32,
                    filter: "blur(4px)",
                  }
            }
            transition={{
              opacity: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
              x: { type: "spring", stiffness: 280, damping: 30, mass: 0.7 },
              filter: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
            }}
          >
            <DealsTable deals={deals} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
