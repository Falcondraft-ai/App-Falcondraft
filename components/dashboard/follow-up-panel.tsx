import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { T } from "@/components/i18n/translated-text";
import type { Deal, DealStatus } from "@/types/deal";

type FollowUpDeal = Pick<
  Deal,
  "id" | "name" | "clientCompanyName" | "status" | "updatedAt" | "lastAction"
>;

type NodeStatus = "done" | "active" | "pending" | "failed";

function getNodeStatus(status: DealStatus): NodeStatus {
  if (status === "completed") return "done";
  if (status === "failed") return "failed";
  if (
    status === "validation_pending" ||
    status === "signature_ready" ||
    status === "email_draft_ready" ||
    status === "proposal_ready"
  ) {
    return "active";
  }
  return "pending";
}

const stageLabel: Record<DealStatus, { title: string; sub: string }> = {
  draft: { title: "Deal", sub: "Cadrage client" },
  call_summary_ready: { title: "Compte-rendu", sub: "Synthèse de l'appel" },
  proposal_generating: { title: "Proposition", sub: "Génération en cours" },
  proposal_ready: { title: "Proposition", sub: "Document prêt à envoyer" },
  validation_pending: { title: "Validation", sub: "Vérification interne" },
  final_document_generating: { title: "Document final", sub: "Génération du PDF" },
  final_document_ready: { title: "Document final", sub: "PDF finalisé" },
  signature_ready: { title: "Signature", sub: "Lien de signature" },
  email_draft_ready: { title: "Email d'envoi", sub: "Brouillon personnalisable" },
  completed: { title: "Terminé", sub: "Email envoyé" },
  failed: { title: "Erreur", sub: "Génération à reprendre" },
};

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
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-2"
        style={{
          background: "var(--brand-navy-800)",
          borderColor: "var(--brand-navy-800)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-2.5 w-2.5"
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
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 bg-white"
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
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-2"
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
      className="block h-[18px] w-[18px] rounded-full border-2 bg-white"
      style={{ borderColor: "var(--border-2)" }}
    />
  );
}

const ROW_HEIGHT = 64; // each row in the zigzag timeline

export function FollowUpPanel({ deals }: { deals: FollowUpDeal[] }) {
  return (
    <section
      className="flex flex-col rounded-lg border bg-[var(--bg-surface)] p-5"
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
            Progression de vos dossiers ouverts
          </p>
        </div>
        {deals.length > 0 ? (
          <span
            className="fd-meta font-semibold"
            style={{ color: "var(--accent-foreground)" }}
          >
            {deals.length}
          </span>
        ) : null}
      </header>

      {deals.length === 0 ? (
        <p className="text-[13px] leading-5 text-[var(--fg-3)]">
          <T tx="dashboard.followUp.empty" />
        </p>
      ) : (
        <div className="relative flex-1">
          {/* Zigzag spine — SVG path threading through the nodes */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            viewBox={`0 0 100 ${deals.length * ROW_HEIGHT}`}
          >
            {deals.slice(0, -1).map((_, index) => {
              const isLeft = index % 2 === 0;
              const startX = isLeft ? 9 : 91;
              const endX = isLeft ? 91 : 9;
              const startY = index * ROW_HEIGHT + 9;
              const endY = (index + 1) * ROW_HEIGHT + 9;
              const midY = (startY + endY) / 2;
              const state = getNodeStatus(deals[index].status);
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
                  strokeDasharray={state === "pending" ? "3 4" : undefined}
                />
              );
            })}
          </svg>

          <ol className="relative">
            {deals.map((deal, index) => {
              const isLeft = index % 2 === 0;
              const nodeState = getNodeStatus(deal.status);
              const stage = stageLabel[deal.status];
              return (
                <li
                  key={deal.id}
                  className="relative"
                  style={{ height: ROW_HEIGHT }}
                >
                  <Link
                    href={`/dashboard/deals/${deal.id}`}
                    className="group absolute inset-0 flex items-start gap-3 rounded-md px-2 py-1.5 transition-colors"
                    style={{
                      flexDirection: isLeft ? "row" : "row-reverse",
                      background:
                        nodeState === "active"
                          ? "var(--brand-amber-50)"
                          : "transparent",
                    }}
                  >
                    <span className="relative z-10 mt-[2px] shrink-0">
                      <Node state={nodeState} />
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
                          className="truncate text-[13.5px] font-semibold leading-tight"
                          style={{ color: titleTone[nodeState] }}
                        >
                          {stage.title}
                        </p>
                        <span
                          className="shrink-0 font-mono text-[10px] tracking-[0.1em]"
                          style={{ color: subStatusTone[nodeState] }}
                        >
                          {subStatusLabel[nodeState]}
                        </span>
                      </div>
                      <p
                        className="mt-[3px] truncate text-[12px] leading-[1.45]"
                        style={{ color: subTone[nodeState] }}
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
