// ---------------------------------------------------------------------------
// Portfolio import (reprise CRM) — shared constants, statuses and helpers used
// by both the API routes and the review UI. The AI calls themselves live in
// lib/broker/import-classify.ts (server-only).
// ---------------------------------------------------------------------------
import {
  brokerInsuranceTypes,
  type BrokerInsuranceType,
} from "@/lib/broker/clients";
import {
  isBrokerDocumentCategory,
  type BrokerDocumentCategory,
} from "@/lib/broker/documents";
import type {
  BrokerImportFileRow,
  BrokerImportGroupRow,
} from "@/types/database";

// --- Limits -----------------------------------------------------------------
/** Hard cap on files per import batch — keeps a "reprise complète" bounded. */
export const MAX_IMPORT_FILES = 1500;
/** Files analysed per /analyze call (chunked, resumable). */
export const ANALYZE_CHUNK_SIZE = 6;
/** Max bytes we send to the vision model per file (skip huge scans). */
export const MAX_AI_READ_BYTES = 12_000_000; // 12 MB

// --- Statuses ---------------------------------------------------------------
export const importBatchStatuses = [
  "uploading",
  "analyzing",
  "review",
  "committing",
  "completed",
  "failed",
] as const;
export type ImportBatchStatus = (typeof importBatchStatuses)[number];

export const importGroupStatuses = [
  "pending",
  "confirmed",
  "skipped",
  "committed",
] as const;
export type ImportGroupStatus = (typeof importGroupStatuses)[number];

export const importFileAnalysisStatuses = [
  "pending",
  "analyzed",
  "skipped",
  "failed",
] as const;
export type ImportFileAnalysisStatus =
  (typeof importFileAnalysisStatuses)[number];

export function isImportGroupStatus(v: string): v is ImportGroupStatus {
  return (importGroupStatuses as readonly string[]).includes(v);
}

// --- Storage staging --------------------------------------------------------
/** Bucket prefix holding a batch's staged (not-yet-committed) files. */
export function importStagingPrefix(orgId: string, batchId: string): string {
  return `${orgId}/_import/${batchId}`;
}

// --- Category / branch normalisation ---------------------------------------
/** Coerces a loose AI category to a valid broker_documents category. */
export function normalizeImportDocCategory(
  value: string | null | undefined,
): BrokerDocumentCategory {
  if (value && isBrokerDocumentCategory(value)) return value;
  return "other";
}

/** Coerces a loose AI branch to a valid insurance type (or null). */
export function normalizeInsuranceType(
  value: string | null | undefined,
): BrokerInsuranceType | null {
  if (value && (brokerInsuranceTypes as readonly string[]).includes(value)) {
    return value as BrokerInsuranceType;
  }
  return null;
}

// --- Display helpers --------------------------------------------------------
/** Proposed dossier name for a group (mirrors brokerClientDisplayName). */
export function importGroupDisplayName(
  group: Pick<
    BrokerImportGroupRow,
    "client_type" | "first_name" | "last_name" | "company_name" | "email"
  >,
): string {
  if (group.client_type === "company") {
    return group.company_name?.trim() || group.email?.trim() || "Dossier sans nom";
  }
  const full = [group.first_name, group.last_name]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
  return full || group.company_name?.trim() || group.email?.trim() || "Dossier sans nom";
}

/** Top-level folder of a staged file's original path (the strongest grouping
 * signal). "Dupont Jean/contrats/x.pdf" → "Dupont Jean"; a flat file → "". */
export function topLevelFolder(originalPath: string): string {
  const parts = originalPath.split("/").filter(Boolean);
  return parts.length > 1 ? parts[0] : "";
}

// --- Extraction shape (stored in broker_import_files.extracted) -------------
/** What classifyImportFile writes onto a file row. All fields best-effort. */
export type ImportFileExtraction = {
  client_first_name: string | null;
  client_last_name: string | null;
  client_company_name: string | null;
  client_type: "individual" | "company" | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  client_postal_code: string | null;
  client_city: string | null;
  insurance_type: string | null;
  doc_category: BrokerDocumentCategory;
  doc_title: string | null;
  doc_summary: string | null;
  /** Whether this file plausibly belongs in a client dossier (vs junk/template). */
  is_client_document: boolean;
  confidence: number | null;
  /** How the file was read: "ai" (model) or "heuristic" (name/path only). */
  method: "ai" | "heuristic";
};

/** Safe reader for the jsonb extraction blob stored on a file row. */
export function readExtraction(
  file: Pick<BrokerImportFileRow, "extracted">,
): Partial<ImportFileExtraction> {
  const e = file.extracted;
  return (e && typeof e === "object" ? e : {}) as Partial<ImportFileExtraction>;
}

// --- Deterministic clustering ----------------------------------------------
export type ClusterInputFile = {
  id: string;
  folder: string;
  extraction: Partial<ImportFileExtraction>;
};

export type ClusterIdentity = {
  client_type: "individual" | "company";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  insurance_type: string | null;
  confidence: number | null;
};

export type ImportCluster = { fileIds: string[]; identity: ClusterIdentity };

function norm(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function clusterKey(file: ClusterInputFile): string | null {
  if (file.folder) return `folder:${norm(file.folder)}`;
  const email = norm(file.extraction.client_email);
  if (email.includes("@")) return `email:${email}`;
  const name = norm(
    file.extraction.client_company_name ||
      [file.extraction.client_first_name, file.extraction.client_last_name]
        .filter(Boolean)
        .join(" "),
  );
  return name ? `name:${name}` : null;
}

function firstNonEmpty(values: (string | null | undefined)[]): string | null {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
}

/**
 * Groups staged files into proposed dossiers, deterministically: primary signal
 * is the top-level folder, then the extracted email, then the extracted name.
 * Files with no usable signal are returned in `ungrouped` (the "À trier" bucket).
 * Identity per cluster is merged from its files, favouring higher confidence.
 */
export function clusterImportFiles(files: ClusterInputFile[]): {
  clusters: ImportCluster[];
  ungrouped: string[];
} {
  const byKey = new Map<string, ClusterInputFile[]>();
  const ungrouped: string[] = [];

  for (const file of files) {
    const key = clusterKey(file);
    if (!key) {
      ungrouped.push(file.id);
      continue;
    }
    const bucket = byKey.get(key);
    if (bucket) bucket.push(file);
    else byKey.set(key, [file]);
  }

  const clusters: ImportCluster[] = [];
  for (const bucket of byKey.values()) {
    // Lead extraction = highest confidence, so its identity wins ties.
    const sorted = [...bucket].sort(
      (a, b) =>
        (b.extraction.confidence ?? 0) - (a.extraction.confidence ?? 0),
    );
    const ex = sorted.map((f) => f.extraction);
    const company = firstNonEmpty(ex.map((e) => e.client_company_name));
    const first = firstNonEmpty(ex.map((e) => e.client_first_name));
    const last = firstNonEmpty(ex.map((e) => e.client_last_name));
    const explicitType = ex.find((e) => e.client_type)?.client_type ?? null;
    const clientType: "individual" | "company" =
      explicitType === "company" || (!!company && !first && !last)
        ? "company"
        : "individual";
    const confidences = ex
      .map((e) => e.confidence)
      .filter((c): c is number => typeof c === "number");

    clusters.push({
      fileIds: sorted.map((f) => f.id),
      identity: {
        client_type: clientType,
        first_name: clientType === "individual" ? first : null,
        last_name: clientType === "individual" ? last : null,
        company_name: company,
        email: firstNonEmpty(ex.map((e) => e.client_email)),
        phone: firstNonEmpty(ex.map((e) => e.client_phone)),
        address: firstNonEmpty(ex.map((e) => e.client_address)),
        postal_code: firstNonEmpty(ex.map((e) => e.client_postal_code)),
        city: firstNonEmpty(ex.map((e) => e.client_city)),
        insurance_type: firstNonEmpty(ex.map((e) => e.insurance_type)),
        confidence: confidences.length
          ? Math.max(...confidences)
          : null,
      },
    });
  }

  return { clusters, ungrouped };
}
