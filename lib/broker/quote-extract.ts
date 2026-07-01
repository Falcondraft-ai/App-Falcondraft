// Automatic extraction of a company quote (devis) → structured fields that
// pre-fill the validation form. Uses OpenAI (consistent with the bordereau
// extractor and the module's cost-oriented default). The broker always reviews
// and validates before the data feeds the devoir de conseil.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const EXTRACT_MODEL = process.env.COURTIER_EXTRACT_MODEL || "gpt-5.5";

export type QuoteExtraction = {
  insurer_name: string | null;
  product_name: string | null;
  premium_monthly: number | null;
  premium_annual: number | null;
  currency: string | null;
  coverage_summary: string | null;
  deductible: string | null;
  vigilance_points: string | null;
  other_info: string | null;
};

export type QuoteExtractionResult =
  | { ok: true; data: QuoteExtraction }
  | { ok: false; reason: string; message: string };

function num(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function extractQuote(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<QuoteExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason: "ai_unconfigured",
      message: "L'extraction n'est pas activée (OPENAI_API_KEY manquant).",
    };
  }

  const name = input.fileName.toLowerCase();
  const mime = input.mimeType.toLowerCase();
  const isPdf = mime.includes("pdf") || name.endsWith(".pdf");
  const isImage =
    mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|tiff?)$/.test(name);
  if (!isPdf && !isImage) {
    return {
      ok: false,
      reason: "unsupported_format",
      message: "L'extraction automatique ne lit que les PDF ou images.",
    };
  }

  const b64 = input.buffer.toString("base64");
  const schema =
    '{"insurer_name": string|null, "product_name": string|null, "premium_monthly": number|null, "premium_annual": number|null, "currency": string|null, "coverage_summary": string|null, "deductible": string|null, "vigilance_points": string|null, "other_info": string|null}';
  const instruction =
    `Lis ce devis d'assurance (un seul contrat) et extrais TOUTES ses informations au format JSON strict suivant :\n${schema}\n` +
    "Sois EXHAUSTIF — n'omets aucune information utile au devoir de conseil. Règles :\n" +
    "- N'invente JAMAIS une donnée ; mets null si l'information est absente.\n" +
    "- premium_monthly / premium_annual : nombres (point décimal, sans symbole ni texte).\n" +
    "- currency : code ISO (EUR par défaut).\n" +
    "- coverage_summary : liste détaillée des garanties souscrites AVEC leurs plafonds/montants et les options incluses (une garantie par ligne, préfixée de « - »).\n" +
    "- deductible : la ou les franchises telles qu'indiquées.\n" +
    "- vigilance_points : exclusions, délais de carence, conditions ou limitations à signaler au client.\n" +
    "- other_info : toute autre information utile non couverte ci-dessus (durée d'engagement, date d'effet, assistance, services inclus, etc.).";

  const userContent: unknown[] = isPdf
    ? [
        { type: "text", text: instruction },
        {
          type: "file",
          file: {
            filename: input.fileName || "devis.pdf",
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
        model: EXTRACT_MODEL,
        response_format: { type: "json_object" },
        max_completion_tokens: 3000,
        messages: [
          {
            role: "system",
            content:
              "Tu extrais des informations de devis d'assurance en JSON strict. Tu n'inventes jamais de donnée ; si une information est absente, tu mets null.",
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
      message: "La lecture du devis n'a pas abouti. Réessayez ou saisissez manuellement.",
    };
  }

  const payload = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    return {
      ok: false,
      reason: "empty",
      message: "Le devis n'a pas pu être lu. Saisissez les informations manuellement.",
    };
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      reason: "parse_failed",
      message: "Réponse illisible. Saisissez les informations manuellement.",
    };
  }

  return {
    ok: true,
    data: {
      insurer_name: str(raw.insurer_name, 160),
      product_name: str(raw.product_name, 200),
      premium_monthly: num(raw.premium_monthly),
      premium_annual: num(raw.premium_annual),
      currency: str(raw.currency, 8),
      coverage_summary: str(raw.coverage_summary, 5000),
      deductible: str(raw.deductible, 255),
      vigilance_points: str(raw.vigilance_points, 5000),
      other_info: str(raw.other_info, 5000),
    },
  };
}
