import { z } from "zod";

const FORBIDDEN_PLACEHOLDER = "[à_completer]";

function noPlaceholder(value: string | undefined, ctx: z.RefinementCtx) {
  if (
    value != null &&
    value.toLowerCase().includes(FORBIDDEN_PLACEHOLDER.toLowerCase())
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `La valeur contient un placeholder interdit ("${FORBIDDEN_PLACEHOLDER}").`,
    });
  }
}

const billingAddressSchema = z.object({
  street_address: z
    .string()
    .trim()
    .min(1, "L'adresse est obligatoire."),
  city: z
    .string()
    .trim()
    .min(1, "La ville est obligatoire."),
  zip_code: z
    .string()
    .trim()
    .min(1, "Le code postal est obligatoire."),
  country_code: z
    .string()
    .trim()
    .length(2, "Le code pays doit être au format ISO 3166-1 (2 lettres).")
    .toUpperCase(),
});

const quoteClientSchema = z.object({
  client_type: z
    .enum(["company", "individual"])
    .optional()
    .default("company"),
  name: z
    .string()
    .trim()
    .min(1, "Le nom du client est obligatoire.")
    .superRefine(noPlaceholder),
  email: z
    .string()
    .trim()
    .email("L'email du client est invalide.")
    .superRefine(noPlaceholder),
  tax_identification_number: z
    .string()
    .trim()
    .optional()
    .superRefine(noPlaceholder),
  billing_address: billingAddressSchema,
}).superRefine((data, ctx) => {
  if (data.client_type === "company") {
    if (
      !data.tax_identification_number ||
      data.tax_identification_number.trim().length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Le numéro de TVA / SIRET du client est obligatoire pour les entreprises.",
        path: ["tax_identification_number"],
      });
    }
  }
});

const quoteItemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Le titre de la ligne est obligatoire.")
    .superRefine(noPlaceholder),
  description: z.string().trim().optional(),
  quantity: z
    .number()
    .positive("La quantité doit être supérieure à 0."),
  unit_price_ht: z
    .number()
    .positive("Le prix unitaire HT doit être supérieur à 0."),
  tax_rate_percent: z
    .number()
    .min(0, "Le taux de TVA ne peut pas etre negatif.")
    .refine(
      (v) => [0, 5.5, 10, 20].includes(v),
      {
        message:
          "Le taux de TVA doit etre 0, 5.5, 10 ou 20 %.",
      },
    ),
  unit: z.string().trim().optional(),
});

const quotePayloadSchema = z.object({
  currency: z.string().trim().length(3).default("EUR"),
  validity_days: z.number().positive().default(30),
  terms_and_conditions: z.string().trim().optional(),
  items: z
    .array(quoteItemSchema)
    .min(1, "Le devis doit contenir au moins une ligne."),
});

export const createQuoteRequestSchema = z
  .object({
    workflow_run_id: z.string().uuid().optional(),
    organization_id: z
      .string()
      .uuid("organization_id doit être un UUID valide."),
    deal_id: z.string().uuid().optional(),
    provider: z
      .enum(["qonto", "pennylane", "odoo", "invoice_ninja", "manual"])
      .default("qonto"),
    client: quoteClientSchema,
    quote: quotePayloadSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.provider !== "qonto") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Le provider "${data.provider}" n'est pas encore supporté. Seul "qonto" est disponible.`,
        path: ["provider"],
      });
    }

    const grandTotal = data.quote.items.reduce(
      (sum, item) => sum + item.unit_price_ht * item.quantity,
      0,
    );

    if (grandTotal <= 0.001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le montant total du devis ne peut pas être de 0 €.",
        path: ["quote", "items"],
      });
    }
  });

export type CreateQuoteRequest = z.infer<typeof createQuoteRequestSchema>;
