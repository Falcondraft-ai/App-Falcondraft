import "server-only";

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
const MODEL = process.env.COURTIER_EXTRACT_MODEL || "gpt-5.5";

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

  const b64 = input.buffer.toString("base64");
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
        model: MODEL,
        response_format: { type: "json_object" },
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
  } | null;
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

  return {
    ok: true,
    data: {
      category,
      label: str(raw.label, 160) ?? input.fileName,
      summary: str(raw.summary, 800) ?? "",
      subject_name: str(raw.subject_name, 160),
    },
  };
}
