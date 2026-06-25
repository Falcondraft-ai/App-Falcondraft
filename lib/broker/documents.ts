export const BROKER_FILES_BUCKET = "broker-files";

/** Per-file hard cap (must match the bucket file_size_limit in migration 0032). */
export const MAX_DOCUMENT_SIZE_BYTES = 52428800; // 50 MB

export const brokerDocumentCategories = [
  "contract",
  "id_document",
  "rib",
  "company_quote",
  "advice_document",
  "other",
] as const;

export type BrokerDocumentCategory = (typeof brokerDocumentCategories)[number];

export const brokerDocumentCategoryLabels: Record<
  BrokerDocumentCategory,
  string
> = {
  contract: "Contrat",
  id_document: "Pièce d’identité",
  rib: "RIB",
  company_quote: "Devis compagnie",
  advice_document: "Devoir de conseil",
  other: "Autre pièce",
};

export function isBrokerDocumentCategory(
  value: string,
): value is BrokerDocumentCategory {
  return (brokerDocumentCategories as readonly string[]).includes(value);
}

export function documentCategoryLabel(value: string | null | undefined): string {
  if (!value) return brokerDocumentCategoryLabels.other;
  return (
    brokerDocumentCategoryLabels[value as BrokerDocumentCategory] ?? value
  );
}

/** Allowed upload MIME types (enforced server-side when minting upload URLs). */
export const allowedDocumentMimeTypes = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/tiff",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function isAllowedDocumentMime(mime: string): boolean {
  return allowedDocumentMimeTypes.has(mime);
}

export const documentUploadAccept =
  ".pdf,.png,.jpg,.jpeg,.webp,.heic,.tiff,.doc,.docx,.xls,.xlsx";

/** Strips path separators and unsafe characters from a user file name. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "fichier";
  // NFD + drop combining marks (̀-ͯ) so accents fold to ASCII,
  // then replace anything left outside the safe set.
  const cleaned = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned.slice(0, 120) || "fichier";
}
