import "server-only";
import { logOpenAiUsage, type OpenAiUsage } from "@/lib/ai/usage";
import { reasoningParams } from "@/lib/ai/model";

import ExcelJS from "exceljs";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// Vision/file-capable model for reading bordereaux. Configurable so model/cost
// can be tuned (and calibrated) without a code change.
const EXTRACT_MODEL = process.env.COURTIER_EXTRACT_MODEL || "gpt-5.5";

// Guardrails to stay within token budget on large bordereaux.
const MAX_SPREADSHEET_CHARS = 60_000;
const MAX_SPREADSHEET_ROWS = 600;

export type ExtractionSourceKind = "spreadsheet" | "pdf" | "image";

/**
 * A single commission line as read from the bordereau — raw, before it is
 * matched to a contract/client in the database. `client_name`/`policy_number`
 * are kept as free text so the matching step can resolve them.
 */
export type ExtractedCommissionLine = {
  insurer_name: string | null;
  client_name: string | null;
  policy_number: string | null;
  label: string | null;
  base_amount: number | null;
  rate: number | null;
  commission_amount: number | null;
  retrocession_rate: number | null;
  retrocession_amount: number | null;
  period_label: string | null;
  currency: string;
  confidence: "high" | "medium" | "low";
};

export type ExtractedStatement = {
  insurer_name: string | null;
  period_label: string | null;
  period_start: string | null; // YYYY-MM-DD
  period_end: string | null;
  declared_total: number | null;
  currency: string;
};

export type ExtractionResult =
  | {
      ok: true;
      sourceKind: ExtractionSourceKind;
      statement: ExtractedStatement;
      lines: ExtractedCommissionLine[];
    }
  | { ok: false; reason: string; message: string };

// ---------------------------------------------------------------------------
// Number / text normalisation (French formats)
// ---------------------------------------------------------------------------

/**
 * Parses a number out of a French-formatted string: handles thousands spaces,
 * comma decimals, percent signs, currency symbols, and parenthesised negatives
 * ("(123,45)" → -123.45). Returns null when no number is present.
 */
export function parseFrNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let s = value.trim();
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.includes("-")) negative = true;

  // Drop currency symbols, percent, spaces (incl. narrow no-break) and letters.
  s = s.replace(/[%€$£\s  ]/g, "").replace(/[^0-9.,-]/g, "");
  if (!s) return null;

  // Decide the decimal separator: the last of "," or "." wins; the other is a
  // thousands separator and is stripped.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    // Comma only → decimal separator (FR), unless it looks like a grouping.
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 && !/,\d{1,2}$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }

  s = s.replace(/-/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function cleanString(value: unknown): string | null {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}

function normCurrency(value: unknown): string {
  const s = cleanString(value)?.toUpperCase() ?? "";
  if (s.includes("EUR") || s.includes("€")) return "EUR";
  if (s.includes("USD") || s.includes("$")) return "USD";
  if (s.includes("GBP") || s.includes("£")) return "GBP";
  if (s.includes("CHF")) return "CHF";
  return "EUR";
}

function isLikelyTotalRow(line: ExtractedCommissionLine): boolean {
  const label = (line.label ?? "").toLowerCase();
  const hasIdentity = Boolean(line.client_name || line.policy_number);
  return (
    !hasIdentity &&
    /\b(total|sous-total|cumul|r[ée]capitulatif|s\/total)\b/.test(label)
  );
}

// ---------------------------------------------------------------------------
// File ingestion → text (spreadsheets) or base64 (pdf/image)
// ---------------------------------------------------------------------------

function detectKind(
  mimeType: string,
  fileName: string,
): ExtractionSourceKind | "xls_legacy" | "unsupported" {
  const name = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|tiff?)$/.test(name)) {
    return "image";
  }
  if (mime.includes("csv") || name.endsWith(".csv")) return "spreadsheet";
  if (
    mime.includes("spreadsheetml") ||
    mime.includes("ms-excel") ||
    name.endsWith(".xlsx")
  ) {
    return "spreadsheet";
  }
  if (name.endsWith(".xls")) return "xls_legacy";
  return "unsupported";
}

function detectCsvDelimiter(sample: string): string {
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  for (const line of sample.split(/\r?\n/).slice(0, 10)) {
    for (const d of Object.keys(counts)) {
      counts[d] += line.split(d).length - 1;
    }
  }
  return (
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ";"
  );
}

/** Minimal robust CSV parser (handles quotes + the detected delimiter). */
function parseCsv(text: string): string[][] {
  const delimiter = detectCsvDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function rowsToText(rows: string[][]): string {
  const out: string[] = [];
  let chars = 0;
  for (const row of rows.slice(0, MAX_SPREADSHEET_ROWS)) {
    const line = row
      .map((c) => (c ?? "").toString().replace(/\s+/g, " ").trim())
      .join(" | ");
    if (!line.replace(/\|/g, "").trim()) continue; // skip blank rows
    chars += line.length + 1;
    if (chars > MAX_SPREADSHEET_CHARS) break;
    out.push(line);
  }
  return out.join("\n");
}

async function xlsxToText(buffer: Buffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  // exceljs bundles its own (older) Buffer typing that conflicts with
  // @types/node's Buffer<ArrayBufferLike>; cast to exceljs' declared param type.
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const blocks: string[] = [];
  for (const ws of wb.worksheets) {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(
        values.map((v) => {
          if (v == null) return "";
          if (typeof v === "object" && "text" in v) {
            return String((v as { text: unknown }).text ?? "");
          }
          if (typeof v === "object" && "result" in v) {
            return String((v as { result: unknown }).result ?? "");
          }
          return String(v);
        }),
      );
    });
    if (rows.length) {
      blocks.push(`# Feuille: ${ws.name}\n${rowsToText(rows)}`);
    }
  }
  return blocks.join("\n\n");
}

// ---------------------------------------------------------------------------
// AI prompt
// ---------------------------------------------------------------------------

function systemPrompt(): string {
  return [
    `Tu es un expert du back-office d'un cabinet de courtage en assurance. On te fournit un BORDEREAU DE COMMISSIONS émis par une compagnie d'assurance (format libre, propre à chaque assureur).`,
    ``,
    `OBJECTIF : extraire chaque LIGNE de commission, plus les métadonnées du bordereau, en JSON strict.`,
    ``,
    `RÈGLES :`,
    `- Chaque assureur nomme ses colonnes différemment. Mappe intelligemment : assiette/prime/base → base_amount ; taux/% → rate ; commission/rémunération/honoraires → commission_amount ; rétrocession/reversement → retrocession_amount.`,
    `- IGNORE les lignes de TOTAL, sous-total, cumul ou récapitulatif : ce ne sont pas des commissions individuelles.`,
    `- Conserve les montants NÉGATIFS (reprises, régularisations, annulations) avec leur signe.`,
    `- N'invente jamais une donnée absente : mets null.`,
    `- policy_number = numéro de contrat/police tel qu'écrit. client_name = nom de l'assuré/souscripteur tel qu'écrit (ne le déduis pas).`,
    `- Les nombres : renvoie-les en nombres décimaux à point (ex. 1234.56), jamais de symbole monétaire ni d'espace.`,
    `- period_start / period_end au format YYYY-MM-DD si une période est lisible, sinon null.`,
    `- declared_total = total des commissions annoncé par la compagnie sur le bordereau (souvent en pied de tableau), sinon null.`,
    `- confidence par ligne : "high" si toutes les valeurs clés sont nettes, "medium" si partiel/ambigu, "low" si très incertain.`,
    ``,
    `Réponds UNIQUEMENT en JSON valide conforme au schéma demandé. Aucune prose.`,
  ].join("\n");
}

function expectedSchema(): string {
  return JSON.stringify({
    statement: {
      insurer_name: "string|null",
      period_label: "string|null",
      period_start: "YYYY-MM-DD|null",
      period_end: "YYYY-MM-DD|null",
      declared_total: "number|null",
      currency: "string (EUR par défaut)",
    },
    lines: [
      {
        insurer_name: "string|null",
        client_name: "string|null",
        policy_number: "string|null",
        label: "string|null",
        base_amount: "number|null",
        rate: "number|null (en %)",
        commission_amount: "number|null",
        retrocession_rate: "number|null",
        retrocession_amount: "number|null",
        period_label: "string|null",
        currency: "string",
        confidence: "high|medium|low",
      },
    ],
  });
}

type AiRaw = {
  statement?: Partial<ExtractedStatement> & Record<string, unknown>;
  lines?: Array<Partial<ExtractedCommissionLine> & Record<string, unknown>>;
};

function normalizeLine(
  raw: Partial<ExtractedCommissionLine> & Record<string, unknown>,
  fallbackCurrency: string,
): ExtractedCommissionLine {
  const currency = raw.currency ? normCurrency(raw.currency) : fallbackCurrency;
  const conf = raw.confidence;
  return {
    insurer_name: cleanString(raw.insurer_name),
    client_name: cleanString(raw.client_name),
    policy_number: cleanString(raw.policy_number),
    label: cleanString(raw.label),
    base_amount: parseFrNumber(raw.base_amount),
    rate: parseFrNumber(raw.rate),
    commission_amount: parseFrNumber(raw.commission_amount),
    retrocession_rate: parseFrNumber(raw.retrocession_rate),
    retrocession_amount: parseFrNumber(raw.retrocession_amount),
    period_label: cleanString(raw.period_label),
    currency,
    confidence:
      conf === "high" || conf === "medium" || conf === "low" ? conf : "medium",
  };
}

async function callOpenAI(
  apiKey: string,
  userContent: unknown,
): Promise<AiRaw | null> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: EXTRACT_MODEL,
      ...reasoningParams(EXTRACT_MODEL, "low"),
      response_format: { type: "json_object" },
      max_completion_tokens: 8000,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: userContent },
      ],
    }),
  }).catch(() => null);

  if (!res || !res.ok) {
    console.error("[commission-extract] openai error", res?.status);
    return null;
  }
  const payload = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    usage?: OpenAiUsage;
  } | null;
  logOpenAiUsage("commission_extract", EXTRACT_MODEL, payload?.usage);
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return JSON.parse(content) as AiRaw;
  } catch {
    console.error("[commission-extract] invalid AI JSON");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export async function extractBordereau(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<ExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason: "ai_unconfigured",
      message: "L’extraction n’est pas activée (OPENAI_API_KEY manquant).",
    };
  }

  const kind = detectKind(input.mimeType, input.fileName);
  if (kind === "unsupported") {
    return {
      ok: false,
      reason: "unsupported_format",
      message: "Format non pris en charge. Déposez un PDF, une image, un CSV ou un Excel (.xlsx).",
    };
  }
  if (kind === "xls_legacy") {
    return {
      ok: false,
      reason: "xls_legacy",
      message: "Les fichiers .xls anciens ne sont pas lisibles. Exportez en .xlsx ou en CSV.",
    };
  }

  let userContent: unknown;
  try {
    if (kind === "spreadsheet") {
      const isCsv =
        input.mimeType.toLowerCase().includes("csv") ||
        input.fileName.toLowerCase().endsWith(".csv");
      const text = isCsv
        ? rowsToText(parseCsv(input.buffer.toString("utf8")))
        : await xlsxToText(input.buffer);
      if (!text.trim()) {
        return {
          ok: false,
          reason: "empty_file",
          message: "Le fichier semble vide ou illisible.",
        };
      }
      userContent = [
        {
          type: "text",
          text: `Voici le contenu du bordereau (tableau). Extrais les lignes de commission au schéma:\n${expectedSchema()}\n\nBORDEREAU:\n${text}`,
        },
      ];
    } else if (kind === "pdf") {
      const b64 = input.buffer.toString("base64");
      userContent = [
        {
          type: "text",
          text: `Lis ce bordereau PDF et extrais les lignes de commission au schéma:\n${expectedSchema()}`,
        },
        {
          type: "file",
          file: {
            filename: input.fileName || "bordereau.pdf",
            file_data: `data:application/pdf;base64,${b64}`,
          },
        },
      ];
    } else {
      const b64 = input.buffer.toString("base64");
      const mime = input.mimeType.startsWith("image/")
        ? input.mimeType
        : "image/png";
      userContent = [
        {
          type: "text",
          text: `Lis ce bordereau (image) et extrais les lignes de commission au schéma:\n${expectedSchema()}`,
        },
        { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
      ];
    }
  } catch (error) {
    console.error("[commission-extract] ingestion failed", error);
    return {
      ok: false,
      reason: "parse_failed",
      message: "Lecture du fichier impossible. Vérifiez qu’il n’est pas corrompu.",
    };
  }

  const ai = await callOpenAI(apiKey, userContent);
  if (!ai) {
    return {
      ok: false,
      reason: "ai_failed",
      message: "L’analyse du bordereau a échoué. Réessayez dans un instant.",
    };
  }

  const fallbackCurrency = normCurrency(ai.statement?.currency);
  const statement: ExtractedStatement = {
    insurer_name: cleanString(ai.statement?.insurer_name),
    period_label: cleanString(ai.statement?.period_label),
    period_start: cleanString(ai.statement?.period_start),
    period_end: cleanString(ai.statement?.period_end),
    declared_total: parseFrNumber(ai.statement?.declared_total),
    currency: fallbackCurrency,
  };

  const lines = (Array.isArray(ai.lines) ? ai.lines : [])
    .map((l) => normalizeLine(l, fallbackCurrency))
    // Keep only lines that carry a real commission signal, drop total rows.
    .filter(
      (l) =>
        !isLikelyTotalRow(l) &&
        (l.commission_amount !== null ||
          l.client_name !== null ||
          l.policy_number !== null),
    );

  return { ok: true, sourceKind: kind, statement, lines };
}
