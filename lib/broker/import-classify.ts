import "server-only";

// Per-file classification for the portfolio import. Reads a PDF/image with the
// vision model (same pattern & cost stance as lib/broker/quote-extract.ts) to
// extract who the file belongs to + what kind of document it is. Formats the
// model can't read (docx/xlsx) fall back to a filename/path heuristic. Never
// throws — always returns a usable extraction so the batch keeps moving.

import {
  brokerInsuranceTypes,
  type BrokerInsuranceType,
} from "@/lib/broker/clients";
import {
  normalizeImportDocCategory,
  normalizeInsuranceType,
  topLevelFolder,
  type ImportFileExtraction,
} from "@/lib/broker/imports";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const IMPORT_MODEL = process.env.COURTIER_IMPORT_MODEL || "gpt-5.5";

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function confidenceOf(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
}

function clientTypeOf(value: unknown): "individual" | "company" | null {
  return value === "company" ? "company" : value === "individual" ? "individual" : null;
}

// --- Heuristic fallback (name/path only) -----------------------------------
function heuristicCategory(name: string): ImportFileExtraction["doc_category"] {
  const n = name.toLowerCase();
  if (/(cni|carte.?identit|passeport|permis|titre.?sejour|id[_-]?doc)/.test(n))
    return "id_document";
  if (/(rib|iban|bancaire|coordonnees.?bancaires)/.test(n)) return "rib";
  if (/(devis|proposition|tarif|cotation)/.test(n)) return "company_quote";
  if (/(devoir.?de.?conseil|conseil|fiche.?information)/.test(n))
    return "advice_document";
  if (/(contrat|police|avenant|attestation|souscription|ci[_-]?particuli)/.test(n))
    return "contract";
  return "other";
}

/** Best-effort classification without reading the bytes (non-PDF/image). */
function heuristicExtraction(
  fileName: string,
  originalPath: string,
): ImportFileExtraction {
  return {
    client_first_name: null,
    client_last_name: null,
    client_company_name: null,
    client_type: null,
    client_email: null,
    client_phone: null,
    client_address: null,
    client_postal_code: null,
    client_city: null,
    insurance_type: null,
    doc_category: heuristicCategory(`${originalPath} ${fileName}`),
    doc_title: fileName,
    doc_summary: null,
    is_client_document: true,
    confidence: 0.3,
    method: "heuristic",
  };
}

function buildInstruction(fileName: string, folderHint: string): string {
  const schema =
    '{"client_first_name": string|null, "client_last_name": string|null, ' +
    '"client_company_name": string|null, "client_type": "individual"|"company"|null, ' +
    '"client_email": string|null, "client_phone": string|null, ' +
    '"client_address": string|null, "client_postal_code": string|null, ' +
    '"client_city": string|null, "insurance_type": ' +
    brokerInsuranceTypes.map((t) => `"${t}"`).join("|") +
    '|null, "doc_category": "contract"|"id_document"|"rib"|"company_quote"|"advice_document"|"other", ' +
    '"doc_title": string|null, "doc_summary": string|null, ' +
    '"is_client_document": boolean, "confidence": number}';
  return [
    "Ce fichier provient du portefeuille désordonné d'un cabinet de courtage en assurance qu'on est en train de reprendre dans un CRM.",
    folderHint
      ? `Il se trouvait dans un dossier nommé « ${folderHint} » (souvent le nom du client — à confirmer par le contenu).`
      : "",
    `Nom du fichier : « ${fileName} ».`,
    "Analyse son CONTENU et renvoie STRICTEMENT ce JSON :",
    schema,
    "Règles :",
    "- N'invente JAMAIS : mets null si l'information n'apparaît pas clairement.",
    "- Identifie le CLIENT (particulier ou entreprise) à qui appartient la pièce, pas l'assureur/la compagnie.",
    "- client_email/phone : ceux du client uniquement.",
    "- doc_category : contract (contrat/police/attestation), id_document (pièce d'identité), rib, company_quote (devis d'une compagnie), advice_document (devoir de conseil), other.",
    "- insurance_type : la branche concernée si identifiable.",
    "- is_client_document = false si le fichier n'a pas sa place dans un dossier client (logo, modèle vierge, note interne, publicité…).",
    "- confidence : 0 à 1, ta certitude globale sur l'identification du client.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Classifies one staged file. PDF/images are read by the model; other formats
 * use a filename heuristic. Returns null-safe extraction (never throws).
 */
export async function classifyImportFile(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  originalPath: string;
  maxAiBytes: number;
}): Promise<ImportFileExtraction> {
  const folderHint = topLevelFolder(input.originalPath);
  const name = input.fileName.toLowerCase();
  const mime = input.mimeType.toLowerCase();
  const isPdf = mime.includes("pdf") || name.endsWith(".pdf");
  const isImage =
    mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|tiff?)$/.test(name);

  const apiKey = process.env.OPENAI_API_KEY;
  // No AI, unreadable format, or oversized file → heuristic.
  if (
    !apiKey ||
    (!isPdf && !isImage) ||
    input.buffer.byteLength > input.maxAiBytes
  ) {
    return heuristicExtraction(input.fileName, input.originalPath);
  }

  const b64 = input.buffer.toString("base64");
  const instruction = buildInstruction(input.fileName, folderHint);
  const userContent: unknown[] = isPdf
    ? [
        { type: "text", text: instruction },
        {
          type: "file",
          file: {
            filename: input.fileName || "document.pdf",
            file_data: `data:application/pdf;base64,${b64}`,
          },
        },
      ]
    : [
        { type: "text", text: instruction },
        {
          type: "image_url",
          image_url: {
            url: `data:${mime.startsWith("image/") ? mime : "image/png"};base64,${b64}`,
          },
        },
      ];

  let res: Response | null;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: IMPORT_MODEL,
        response_format: { type: "json_object" },
        max_completion_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "Tu classes des documents d'assurance pour une reprise de portefeuille. Tu réponds en JSON strict et n'inventes jamais de donnée.",
          },
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch {
    res = null;
  }

  if (!res || !res.ok) {
    return heuristicExtraction(input.fileName, input.originalPath);
  }

  const payload = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) return heuristicExtraction(input.fileName, input.originalPath);

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return heuristicExtraction(input.fileName, input.originalPath);
  }

  const insuranceType: BrokerInsuranceType | null = normalizeInsuranceType(
    str(raw.insurance_type, 40),
  );

  return {
    client_first_name: str(raw.client_first_name, 120),
    client_last_name: str(raw.client_last_name, 120),
    client_company_name: str(raw.client_company_name, 160),
    client_type: clientTypeOf(raw.client_type),
    client_email: str(raw.client_email, 200)?.toLowerCase() ?? null,
    client_phone: str(raw.client_phone, 40),
    client_address: str(raw.client_address, 240),
    client_postal_code: str(raw.client_postal_code, 20),
    client_city: str(raw.client_city, 120),
    insurance_type: insuranceType,
    doc_category: normalizeImportDocCategory(str(raw.doc_category, 40)),
    doc_title: str(raw.doc_title, 200) ?? input.fileName,
    doc_summary: str(raw.doc_summary, 1000),
    is_client_document: raw.is_client_document !== false,
    confidence: confidenceOf(raw.confidence),
    method: "ai",
  };
}
