import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { T } from "@/components/i18n/translated-text";
import type { Deal, DealStatus } from "@/types/deal";

type FollowUpDeal = Pick<
  Deal,
  "id" | "name" | "clientCompanyName" | "status" | "updatedAt" | "lastAction"
>;

type NodeStatus = "done" | "active" | "pending" | "failed";

type Stage = { title: string; sub: string; state: NodeStatus };

// Return the *next action expected* on the deal, not the step already done.
// A deal at `call_summary_ready` means the summary IS generated and the
// next thing to do is generate the proposal — so we show "Proposition" /
// "Génération à lancer" with state = active.
function stageForDeal(status: DealStatus): Stage {
  switch (status) {
    case "draft":
      return {
        title: "Compte-rendu",
        sub: "À générer depuis le transcript",
        state: "active",
      };
    case "call_summary_ready":
      return {
        title: "Proposition",
        sub: "À générer (compte-rendu prêt)",
        state: "active",
      };
    case "proposal_generating":
      return {
        title: "Proposition",
        sub: "Génération en cours",
        state: "active",
      };
    case "proposal_ready":
      return {
        title: "Proposition",
        sub: "Document prêt à valider",
        state: "active",
      };
    case "validation_pending":
      return {
        title: "Validation",
        sub: "Vérification interne en cours",
        state: "active",
      };
    case "final_document_generating":
      return {
        title: "Document final",
        sub: "Génération du PDF",
        state: "active",
      };
    case "final_document_ready":
      return {
        title: "Document final",
        sub: "PDF prêt à envoyer",
        state: "active",
      };
    case "signature_ready":
      return {
        title: "Signature",
        sub: "Lien à transmettre au client",
        state: "active",
      };
    case "email_draft_ready":
      return {
        title: "Email d'envoi",
        sub: "Brouillon prêt — à envoyer",
        state: "active",
      };
    case "completed":
      return { title: "Terminé", sub: "Email envoyé", state: "done" };
    case "failed":
      return {
        title: "Erreur",
        sub: "Génération à reprendre",
        state: "failed",
      };
  }
}

const subStatusLabel: Record<NodeStatus, string> = {
  done: "FAIT",
  active: "ACTIF",
  pending: "À VENIR",
  failed: "ÉCHEC",
};

const subStatusTone: Record<NodeStatus, string> = {
  done: "var(--fg-3)",
  active: "var(--accent-foreground)",
  pending: "var(--fg-4)",
  failed: "var(--status-error-fg)",
};

const titleTone: Record<NodeStatus, string> = {
  done: "var(--fg-1)",
  active: "var(--accent-foreground)",
  pending: "var(--fg-1)",
  failed: "var(--status-error-fg)",
};

const subTone: Record<NodeStatus, string> = {
  done: "var(--fg-3)",
  active: "var(--brand-amber-700)",
  pending: "var(--fg-3)",
  failed: "var(--status-error-fg)",
};

function Node({ state }: { state: NodeStatus }) {
  if (state === "done") {
    return (
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full border-2"
        style={{
          background: "var(--brand-navy-800)",
          borderColor: "var(--brand-navy-800)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3 w-3"
          fill="none"
          stroke="#fff"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 12 5 5 9-9" />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white"
        style={{
          borderColor: "var(--accent)",
          boxShadow: "0 0 0 5px rgba(184,146,42,0.18)",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--accent)" }}
        />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full border-2"
        style={{
          background: "var(--status-error-fg)",
          borderColor: "var(--status-error-fg)",
        }}
      >
        <span className="h-1 w-1 rounded-full bg-white" />
      </span>
    );
  }
  return (
    <span
      className="block h-5 w-5 rounded-full border-2 bg-white"
      style={{ borderColor: "var(--border-2)" }}
    />
  );
}

const ROW_HEIGHT = 78;

export function FollowUpPanel({ deals }: { deals: FollowUpDeal[] }) {
  return (
    <section
      className="flex flex-col rounded-lg border bg-[var(--bg-surface)] p-4 sm:p-5"
      style={{
        borderColor: "var(--border-1)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.005em] text-[var(--fg-1)]">
            <T tx="dashboard.followUp.title" />
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--fg-3)]">
            Prochaine action à mener par dossier
          </p>
        </div>
        {deals.length > 0 ? (
          <span
            className="inline-flex items-center rounded-full px-2 py-[3px] text-[10.5px] font-semibold tracking-[0.08em] uppercase"
            style={{
              background: "var(--brand-amber-50)",
              color: "var(--brand-amber-800)",
              border: "1px solid var(--brand-amber-200)",
            }}
          >
            {deals.length} actif{deals.length > 1 ? "s" : ""}
          </span>
        ) : null}
      </header>

      {deals.length === 0 ? (
        <p className="text-[13px] leading-5 text-[var(--fg-3)]">
          <T tx="dashboard.followUp.empty" />
        </p>
      ) : (
        <div className="relative flex-1">
          {/* Zigzag spine threading through the nodes */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            viewBox={`0 0 100 ${deals.length * ROW_HEIGHT}`}
          >
            {deals.slice(0, -1).map((deal, index) => {
              const isLeft = index % 2 === 0;
              const startX = isLeft ? 10 : 90;
              const endX = isLeft ? 90 : 10;
              const startY = index * ROW_HEIGHT + 14;
              const endY = (index + 1) * ROW_HEIGHT + 14;
              const midY = (startY + endY) / 2;
              const state = stageForDeal(deal.status).state;
              const stroke =
                state === "done"
                  ? "var(--brand-navy-800)"
                  : state === "failed"
                    ? "var(--status-error-bd)"
                    : "var(--border-2)";
              return (
                <path
                  key={`spine-${index}`}
                  d={`M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          <ol className="relative">
            {deals.map((deal, index) => {
              const isLeft = index % 2 === 0;
              const stage = stageForDeal(deal.status);
              return (
                <li
                  key={deal.id}
                  className="relative"
                  style={{ height: ROW_HEIGHT }}
                >
                  <Link
                    href={`/dashboard/deals/${deal.id}`}
                    className="group absolute inset-0 flex items-start gap-3 rounded-md px-2 py-2 transition-colors"
                    style={{
                      flexDirection: isLeft ? "row" : "row-reverse",
                      background:
                        stage.state === "active"
                          ? "var(--brand-amber-50)"
                          : stage.state === "done"
                            ? "var(--brand-navy-50)"
                            : "transparent",
                      border:
                        stage.state === "active"
                          ? "1px solid var(--brand-amber-200)"
                          : "1px solid transparent",
                    }}
                  >
                    <span className="relative z-10 mt-[1px] shrink-0">
                      <Node state={stage.state} />
                    </span>
                    <div
                      className="min-w-0 flex-1"
                      style={{ textAlign: isLeft ? "left" : "right" }}
                    >
                      <div
                        className="flex items-baseline gap-3"
                        style={{
                          flexDirection: isLeft ? "row" : "row-reverse",
                        }}
                      >
                        <p
                          className="truncate text-[14px] font-semibold leading-tight"
                          style={{ color: titleTone[stage.state] }}
                        >
                          {stage.title}
                        </p>
                        <span
                          className="shrink-0 font-mono text-[10px] font-semibold tracking-[0.12em]"
                          style={{ color: subStatusTone[stage.state] }}
                        >
                          {subStatusLabel[stage.state]}
                        </span>
                      </div>
                      <p
                        className="mt-[3px] truncate text-[12px] leading-[1.45]"
                        style={{ color: subTone[stage.state] }}
                      >
                        {stage.sub}
                      </p>
                      <p className="mt-[1px] truncate text-[11px] text-[var(--fg-4)]">
                        {deal.clientCompanyName || deal.name}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div
        className="mt-5 flex items-center justify-end border-t pt-3"
        style={{ borderColor: "var(--border-1)" }}
      >
        <Link
          href="/dashboard/deals"
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--brand-navy-700)] transition-colors hover:text-[var(--brand-navy-900)]"
        >
          <T tx="dashboard.followUp.viewAll" />
          <ArrowRight className="size-3" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
