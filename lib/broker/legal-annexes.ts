import { promises as fs } from "node:fs";
import path from "node:path";
import type { OutlookDraftAttachment } from "@/lib/email/outlook-drafts";

// Cabinet-static legal documents joined to the devoir de conseil email.
// V1 (courtier sur mesure) reads them from public assets; a future multi-tenant
// version would store one set per organization.
const ANNEXES: { file: string; filename: string }[] = [
  { file: "brand/entree-en-relation.pdf", filename: "Document d'entrée en relation.pdf" },
  { file: "brand/mentions-obligatoires.pdf", filename: "Mentions d'information.pdf" },
];

/** Loads the cabinet's static legal annexes as Outlook attachments (skips any missing). */
export async function loadCabinetLegalAnnexes(): Promise<OutlookDraftAttachment[]> {
  const attachments: OutlookDraftAttachment[] = [];
  for (const annex of ANNEXES) {
    try {
      const buffer = await fs.readFile(
        path.join(process.cwd(), "public", annex.file),
      );
      attachments.push({
        filename: annex.filename,
        contentType: "application/pdf",
        contentBase64: buffer.toString("base64"),
      });
    } catch {
      // Annex not present for this cabinet — skip it.
    }
  }
  return attachments;
}
