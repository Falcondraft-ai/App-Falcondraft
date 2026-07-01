// DocuSeal cloud REST API client (https://www.docuseal.com/docs/api).
// Flow used: create a one-off template from the generated PDF (the signature
// field is auto-detected from the invisible "{{…;type=signature}}" tag), then a
// submission with send_email:false — the broker transmits the signing link.

const DOCUSEAL_BASE_URL =
  process.env.DOCUSEAL_BASE_URL || "https://api.docuseal.com";

// Must match the role in the PDF signature tag (lib/broker/pdf/render.tsx).
const CLIENT_ROLE = "Client";

export type DocusealCreateResult =
  | { success: true; submissionId: number; signingUrl: string }
  | { success: false; reason: string; message: string };

const UNCONFIGURED = {
  success: false as const,
  reason: "unconfigured",
  message:
    "La signature électronique n'est pas activée (DOCUSEAL_API_KEY manquant).",
};

const GENERIC_FAIL = {
  success: false as const,
  reason: "api_error",
  message: "La création du lien de signature n'a pas abouti. Réessayez.",
};

function authHeaders(key: string): Record<string, string> {
  return { "Content-Type": "application/json", "X-Auth-Token": key };
}

/**
 * Creates a DocuSeal submission for the client to sign. Returns the signing URL
 * (to be transmitted by the broker) and the submission id (for status polling).
 */
export async function createDevoirConseilSubmission(input: {
  pdfBase64: string;
  documentName: string;
  clientName: string;
  clientEmail: string;
}): Promise<DocusealCreateResult> {
  const key = process.env.DOCUSEAL_API_KEY;
  if (!key) return UNCONFIGURED;

  // 1. One-off template from the PDF (signature field auto-detected from tag).
  let templateId: number;
  try {
    const res = await fetch(`${DOCUSEAL_BASE_URL}/templates/pdf`, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify({
        name: input.documentName,
        documents: [{ name: input.documentName, file: input.pdfBase64 }],
      }),
    });
    if (!res.ok) {
      console.error("[docuseal] template/pdf failed:", res.status);
      return GENERIC_FAIL;
    }
    const tpl = (await res.json().catch(() => null)) as { id?: number } | null;
    if (!tpl?.id) return GENERIC_FAIL;
    templateId = tpl.id;
  } catch (error) {
    console.error("[docuseal] template/pdf error:", error);
    return { success: false, reason: "network", message: GENERIC_FAIL.message };
  }

  // 2. Submission — no email sent; the broker transmits the link.
  try {
    const res = await fetch(`${DOCUSEAL_BASE_URL}/submissions`, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify({
        template_id: templateId,
        send_email: false,
        submitters: [
          {
            role: CLIENT_ROLE,
            email: input.clientEmail,
            name: input.clientName,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[docuseal] submissions failed:", res.status);
      return GENERIC_FAIL;
    }
    const submitters = (await res.json().catch(() => null)) as
      | { submission_id?: number; slug?: string; embed_src?: string }[]
      | null;
    const first = submitters?.[0];
    if (!first?.submission_id || !first.slug) return GENERIC_FAIL;
    const signingUrl =
      first.embed_src || `https://docuseal.com/s/${first.slug}`;
    return {
      success: true,
      submissionId: first.submission_id,
      signingUrl,
    };
  } catch (error) {
    console.error("[docuseal] submissions error:", error);
    return { success: false, reason: "network", message: GENERIC_FAIL.message };
  }
}

/** Polls a submission's status. Returns null when unavailable/unconfigured. */
export async function getSubmissionStatus(
  submissionId: string | number,
): Promise<{ status: string; completed: boolean } | null> {
  const key = process.env.DOCUSEAL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `${DOCUSEAL_BASE_URL}/submissions/${submissionId}`,
      { headers: { "X-Auth-Token": key } },
    );
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as {
      status?: string;
    } | null;
    if (!data?.status) return null;
    return { status: data.status, completed: data.status === "completed" };
  } catch (error) {
    console.error("[docuseal] status error:", error);
    return null;
  }
}
