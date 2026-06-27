import "server-only";

import { brokerClientDisplayName } from "@/lib/broker/clients";
import type { BrokerClientRow, BrokerContractRow } from "@/types/database";
import type { ExtractedCommissionLine } from "@/lib/broker/commission-extract";

export type LineMatch = {
  clientId: string | null;
  contractId: string | null;
  confidence: "high" | "medium" | "none";
  reason: string;
};

export type MatchedCommissionLine = ExtractedCommissionLine & {
  match: LineMatch;
  clientName: string | null;
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Policy numbers compared without spaces/punctuation/case. */
function normPolicy(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Names compared lowercased, de-accented, single-spaced. */
function normName(value: string | null | undefined): string {
  return stripAccents((value ?? "").toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ClientIndexEntry = { id: string; norm: string; tokens: Set<string> };

/**
 * Builds the lookup structures once per import so each line is matched in O(1)
 * on policy number and a bounded scan on names.
 */
export function buildMatchIndex(
  clients: BrokerClientRow[],
  contracts: BrokerContractRow[],
) {
  const contractByPolicy = new Map<string, BrokerContractRow>();
  const contractsByClient = new Map<string, BrokerContractRow[]>();
  for (const c of contracts) {
    const p = normPolicy(c.policy_number);
    if (p) contractByPolicy.set(p, c);
    const list = contractsByClient.get(c.client_id) ?? [];
    list.push(c);
    contractsByClient.set(c.client_id, list);
  }

  const clientIndex: ClientIndexEntry[] = clients.map((c) => {
    const name = normName(brokerClientDisplayName(c));
    return {
      id: c.id,
      norm: name,
      tokens: new Set(name.split(" ").filter((t) => t.length >= 3)),
    };
  });
  const clientName = new Map(
    clients.map((c) => [c.id, brokerClientDisplayName(c)] as const),
  );

  return { contractByPolicy, contractsByClient, clientIndex, clientName };
}

type MatchIndex = ReturnType<typeof buildMatchIndex>;

function resolveContractForClient(
  index: MatchIndex,
  clientId: string,
  insurer: string | null,
): string | null {
  const contracts = index.contractsByClient.get(clientId) ?? [];
  if (contracts.length === 0) return null;
  if (contracts.length === 1) return contracts[0].id;
  if (insurer) {
    const wantedInsurer = normName(insurer);
    const sameInsurer = contracts.filter(
      (c) => normName(c.insurer_name) === wantedInsurer,
    );
    if (sameInsurer.length === 1) return sameInsurer[0].id;
  }
  return null; // ambiguous → broker assigns
}

/** Find clients whose name is compatible with the bordereau's client_name. */
function matchClients(index: MatchIndex, rawName: string): string[] {
  const target = normName(rawName);
  if (target.length < 3) return [];

  // 1) exact normalised equality.
  const exact = index.clientIndex.filter((c) => c.norm === target);
  if (exact.length) return exact.map((c) => c.id);

  // 2) containment (handles "Jean Dupont" vs "Dupont Jean SARL").
  const targetTokens = new Set(target.split(" ").filter((t) => t.length >= 3));
  const contained = index.clientIndex.filter((c) => {
    if (!c.norm) return false;
    if (target.includes(c.norm) || c.norm.includes(target)) return true;
    // every meaningful client token present in the bordereau name (and ≥2).
    if (c.tokens.size >= 2) {
      let hit = 0;
      for (const t of c.tokens) if (targetTokens.has(t)) hit += 1;
      if (hit === c.tokens.size) return true;
    }
    return false;
  });
  return contained.map((c) => c.id);
}

export function matchLine(
  line: ExtractedCommissionLine,
  index: MatchIndex,
): LineMatch {
  // 1) Policy number is the strongest signal.
  const policy = normPolicy(line.policy_number);
  if (policy) {
    const contract = index.contractByPolicy.get(policy);
    if (contract) {
      return {
        clientId: contract.client_id,
        contractId: contract.id,
        confidence: "high",
        reason: "N° de police identique",
      };
    }
  }

  // 2) Fall back to the client name — only when it resolves unambiguously.
  if (line.client_name) {
    const candidates = matchClients(index, line.client_name);
    if (candidates.length === 1) {
      const clientId = candidates[0];
      return {
        clientId,
        contractId: resolveContractForClient(index, clientId, line.insurer_name),
        confidence: "medium",
        reason: "Nom du client",
      };
    }
    if (candidates.length > 1) {
      return {
        clientId: null,
        contractId: null,
        confidence: "none",
        reason: "Plusieurs clients possibles",
      };
    }
  }

  return {
    clientId: null,
    contractId: null,
    confidence: "none",
    reason: "Aucune correspondance",
  };
}

export function matchExtractedLines(
  lines: ExtractedCommissionLine[],
  clients: BrokerClientRow[],
  contracts: BrokerContractRow[],
): MatchedCommissionLine[] {
  const index = buildMatchIndex(clients, contracts);
  return lines.map((line) => {
    const match = matchLine(line, index);
    return {
      ...line,
      match,
      clientName: match.clientId
        ? index.clientName.get(match.clientId) ?? null
        : null,
    };
  });
}
