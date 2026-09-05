import "server-only";

import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { logOpenAiUsage, type OpenAiUsage } from "@/lib/ai/usage";
import { reasoningParams } from "@/lib/ai/model";

import {
  type AttachmentDocCategory,
  attachmentDocCategories,
  normalizeAttachmentCategory,
} from "@/lib/broker/outlook";

// Generic "what is this document?" reader for the broker workspace. Uses OpenAI
// vision (same approach as the quote extractor) so the assistant and the Outlook
// briefing can actually LOOK at a PDF/image, say what it is, and classify it —
// instead of guessing from the file name. The broker always keeps the final say.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// Identifier un document (5 catégories, un titre, deux phrases, le nom du
// concerné) ne demande pas le modèle le plus capable — et c'est l'appel le plus
// cher du briefing, répété sur chaque pièce jointe. Variable dédiée : cette
// lecture ne partage plus le modèle des extractions chiffrées
// (devis/contrats/bordereaux), qui gardent le haut de gamme.
const MODEL = process.env.COURTIER_DOC_MODEL || "gpt-5.4-mini";

// Pages envoyées d'un PDF. On veut SAVOIR ce qu'est le document, pas en
// extraire les chiffres : la nature, l'émetteur et le nom de l'assuré tiennent
// dans les premières pages. Envoyer un contrat de 40 pages entier pour cette
// réponse-là coûtait le prix fort. L'extraction détaillée, elle, passe par
// quote-extract / contract-extract et reçoit toujours le document complet.
const MAX_PDF_PAGES = Number(process.env.COURTIER_DOC_MAX_PAGES || 3);

/**
 * Mémoire de lecture, par empreinte du fichier.
 *
 * Une même pièce jointe circule dans un fil (réponses, transferts) et revient
 * dans plusieurs emails d'un même briefing : sans cela, elle était relue — et
 * refacturée — à chaque occurrence. Bornée, et volontairement en mémoire de
 * processus : c'est un cache d'exécution, pas une donnée à conserver.
 */
const understandingCache = new Map<string, DocumentUnderstanding>();
const UNDERSTANDING_CACHE_MAX = 200;

/** Ne garde le PDF que sur ses premières pages ; l'original si on ne sait pas le découper. */
async function firstPages(buffer: Buffer, maxPages: number): Promise<Buffer> {
  if (!Number.isFinite(maxPages) || maxPages < 1) return buffer;
  try {
    const source = await PDFDocument.load(buffer, { ignoreEncryption: true });
    if (source.getPageCount() <= maxPages) return buffer;
    const trimmed = await PDFDocument.create();
    const pages = await trimmed.copyPages(
      source,
      Array.from({ length: maxPages }, (_, i) => i),
    );
    for (const page of pages) trimmed.addPage(page);
    return Buffer.from(await trimmed.save());
  } catch {
    // PDF exotique ou protégé : mieux vaut l'envoyer entier que ne rien lire.
    return buffer;
  }
}

export type DocumentUnderstanding = {
  /** Broker document category the content most closely matches. */
  category: AttachmentDocCategory;
  /** Short human title of the document, e.g. "Devis auto — AXA". */
  label: string;
  /** 1–3 sentences describing what the document actually contains. */
  summary: string;
  /** Person or company the document concerns, if clearly identifiable. */
  subject_name: string | null;
};

export type DocumentUnderstandingResult =
  | { ok: true; data: DocumentUnderstanding }
  | { ok: false; reason: string; message: string };

/** True when the file can be read by the vision model (PDF or image). */
export function isReadableDocument(mimeType: string, fileName: string): boolean {
  const mime = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();
  const isPdf = mime.includes("pdf") || name.endsWith(".pdf");
  const isImage =
    mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|tiff?|heic)$/.test(name);
  return isPdf || isImage;
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Reads a document (PDF or image) and returns what it is: a broker category,
 * a short label, a content summary, and who it concerns. Never invents data.
 */
export async function understandDocument(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  /** Organisation à qui imputer les jetons dans le journal d'usage. */
  organizationId?: string | null;
}): Promise<DocumentUnderstandingResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason: "ai_unconfigured",
      message: "La lecture des documents n'est pas activée (OPENAI_API_KEY manquant).",
    };
  }

  const mime = input.mimeType.toLowerCase();
  const name = input.fileName.toLowerCase();
  const isPdf = mime.includes("pdf") || name.endsWith(".pdf");
  if (!isReadableDocument(input.mimeType, input.fileName)) {
    return {
      ok: false,
      reason: "unsupported_format",
      message: "Seuls les PDF et les images peuvent être lus automatiquement.",
    };
  }

  // Même fichier déjà lu (fil de discussion, transfert) → on ne repaie pas.
  const fingerprint = createHash("sha256")
    .update(input.buffer)
    .update(`|${MODEL}|${MAX_PDF_PAGES}`)
    .digest("hex");
  const cached = understandingCache.get(fingerprint);
  if (cached) return { ok: true, data: cached };

  const payloadBuffer = isPdf
    ? await firstPages(input.buffer, MAX_PDF_PAGES)
    : input.buffer;
  const b64 = payloadBuffer.toString("base64");
  const schema =
    '{"category": "company_quote|contract|rib|id_document|other", "label": string, "summary": string, "subject_name": string|null}';
  const instruction =
    "Tu examines un document reçu par un cabinet de courtage en assurance. Dis PRÉCISÉMENT ce que c'est, en JSON strict :\n" +
    `${schema}\n` +
    "Règles :\n" +
    "- category : la nature du document —\n" +
    "  company_quote = devis / proposition tarifaire d'une compagnie d'assurance ;\n" +
    "  contract = contrat, police, conditions générales/particulières, attestation, avenant ;\n" +
    "  rib = RIB / coordonnées bancaires ;\n" +
    "  id_document = pièce d'identité (CNI, passeport, permis, Kbis) ;\n" +
    "  other = tout le reste (facture, courrier, tableau, photo de sinistre, etc.).\n" +
    "- label : titre court et parlant en français (ex. « Devis auto AXA », « CNI recto/verso »).\n" +
    "- summary : 1 à 3 phrases décrivant le CONTENU RÉEL du document (ce qu'il contient d'utile au courtier).\n" +
    "- subject_name : la personne ou l'entreprise que concerne le document si elle est clairement identifiable, sinon null.\n" +
    "- N'invente JAMAIS. Si tu ne peux pas lire le document, mets category=other et explique-le dans summary.";

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
            // Reconnaître la nature d'une pièce (CNI, RIB, devis) ne réclame
            // pas la pleine résolution : "high" multiplie les jetons d'image
            // pour une réponse identique sur cette tâche.
            detail: "low",
          },
        },
      ];

  // Sans plafond de durée, un PDF lourd peut suspendre tout le briefing : la
  // lecture d'une pièce jointe est un confort, jamais une raison d'attendre.
  const timeout = AbortSignal.timeout(60_000);

  let res: Response | null;
  try {
    res = await fetch(OPENAI_URL, {
      signal: timeout,
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        ...reasoningParams(MODEL, "low"),
        max_completion_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "Tu identifies et résumes des documents d'assurance en JSON strict. Tu n'inventes jamais ; en cas de doute tu restes factuel.",
          },
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch {
    res = null;
  }

  if (!res || !res.ok) {
    return {
      ok: false,
      reason: "ai_failed",
      message: "La lecture du document n'a pas abouti.",
    };
  }

  const payload = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    usage?: OpenAiUsage;
  } | null;
  logOpenAiUsage("document_understanding", MODEL, payload?.usage, {
    organizationId: input.organizationId ?? null,
  });
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    return { ok: false, reason: "empty", message: "Le document n'a pas pu être lu." };
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "parse_failed", message: "Réponse illisible." };
  }

  const rawCategory = typeof raw.category === "string" ? raw.category : "";
  const category = (attachmentDocCategories as readonly string[]).includes(
    rawCategory,
  )
    ? (rawCategory as AttachmentDocCategory)
    : normalizeAttachmentCategory(rawCategory);

  const data: DocumentUnderstanding = {
    category,
    label: str(raw.label, 160) ?? input.fileName,
    summary: str(raw.summary, 800) ?? "",
    subject_name: str(raw.subject_name, 160),
  };

  if (understandingCache.size >= UNDERSTANDING_CACHE_MAX) {
    // Éviction simple du plus ancien : le cache sert un run en cours, pas un
    // historique — une politique plus fine n'apporterait rien ici.
    const oldest = understandingCache.keys().next().value;
    if (oldest) understandingCache.delete(oldest);
  }
  understandingCache.set(fingerprint, data);

  return { ok: true, data };
}
