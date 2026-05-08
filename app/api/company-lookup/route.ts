import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const companyLookupSchema = z.object({
  companyName: z.string().trim().min(2, "Nom d’entreprise requis."),
});

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(source: unknown, keys: string[]) {
  if (!isJsonObject(source)) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function getObject(source: unknown, key: string) {
  if (!isJsonObject(source)) {
    return null;
  }

  const value = source[key];
  return isJsonObject(value) ? value : null;
}

function getArray(source: unknown, key: string) {
  if (!isJsonObject(source)) {
    return [];
  }

  const value = source[key];
  return Array.isArray(value) ? value : [];
}

function normalizeIdentifier(value: string | null) {
  return value?.replace(/\D/g, "") || null;
}

function formatSiren(value: string | null) {
  const normalizedValue = normalizeIdentifier(value);

  if (!normalizedValue || normalizedValue.length !== 9) {
    return value;
  }

  return normalizedValue.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
}

function formatSiret(value: string | null) {
  const normalizedValue = normalizeIdentifier(value);

  if (!normalizedValue || normalizedValue.length !== 14) {
    return value;
  }

  return normalizedValue.replace(
    /(\d{3})(\d{3})(\d{3})(\d{5})/,
    "$1 $2 $3 $4",
  );
}

function formatVatNumber(value: string | null, siren: string | null) {
  if (value) {
    return value;
  }

  const normalizedSiren = normalizeIdentifier(siren);

  if (!normalizedSiren || normalizedSiren.length !== 9) {
    return null;
  }

  const vatKey = (12 + 3 * (Number(normalizedSiren) % 97)) % 97;
  return `FR${String(vatKey).padStart(2, "0")}${normalizedSiren}`;
}

function formatAddress(company: JsonObject) {
  const headquarters = getObject(company, "siege");
  const source = headquarters ?? company;
  const directAddress = getString(source, ["adresse"]);

  if (directAddress) {
    return directAddress;
  }

  const addressParts = [
    getString(source, ["adresse_ligne_1", "adresse_ligne_1_complete"]),
    getString(source, ["adresse_ligne_2"]),
    [getString(source, ["code_postal"]), getString(source, ["ville"])]
      .filter(Boolean)
      .join(" "),
  ].filter(Boolean);

  return addressParts.length > 0 ? addressParts.join(", ") : null;
}

function formatCapital(value: string | null) {
  if (!value) {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(numericValue);
}

function formatExecutives(company: JsonObject) {
  const representatives = getArray(company, "representants")
    .map((representative) => {
      const fullName = getString(representative, [
        "nom_complet",
        "denomination",
        "nom",
      ]);

      if (fullName) {
        return fullName;
      }

      return [
        getString(representative, ["prenom"]),
        getString(representative, ["nom"]),
      ]
        .filter(Boolean)
        .join(" ");
    })
    .filter(Boolean)
    .slice(0, 6);

  return representatives.length > 0 ? representatives.join(", ") : null;
}

function formatCompanyInfo(company: JsonObject) {
  const headquarters = getObject(company, "siege");
  const siren = getString(company, ["siren"]);
  const siretHeadquarters =
    getString(headquarters, ["siret"]) ?? getString(company, ["siret_siege"]);
  const legalName = getString(company, [
    "nom_entreprise",
    "denomination",
    "raison_sociale",
    "nom_commercial",
  ]);
  const registry = getString(company, ["numero_rcs", "rcs"]);
  const registryOffice = getString(company, ["greffe", "ville_greffe"]);
  const registryLine =
    registry && registryOffice ? `${registry} R.C.S. ${registryOffice}` : registry;
  const lines = [
    ["Raison sociale", legalName],
    ["Adresse du siège", formatAddress(company)],
    ["SIREN", formatSiren(siren)],
    ["SIRET siège", formatSiret(siretHeadquarters)],
    ["Forme juridique", getString(company, ["forme_juridique"])],
    [
      "Numéro de TVA intracommunautaire",
      formatVatNumber(
        getString(company, ["numero_tva_intracommunautaire", "tva"]),
        siren,
      ),
    ],
    ["RCS", registryLine],
    [
      "Capital social",
      formatCapital(getString(company, ["capital", "capital_social"])),
    ],
    ["Dirigeants", formatExecutives(company)],
  ].filter((line): line is [string, string] => Boolean(line[1]));

  return lines.map(([label, value]) => `${label} : ${value}`).join("\n");
}

async function fetchPappersJson(url: URL) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data: unknown = await response.json().catch(() => null);
  return isJsonObject(data) ? data : null;
}

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json(
    {
      success: false,
      message,
      reason,
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.PAPPERS_API_KEY;

  if (!apiKey) {
    return jsonError(
      "La recherche Pappers n’est pas configurée.",
      500,
      "pappers_api_key_missing",
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = companyLookupSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError("Nom d’entreprise invalide.", 400, "invalid_payload");
  }

  const searchUrl = new URL("https://api.pappers.fr/v2/recherche");
  searchUrl.searchParams.set("api_token", apiKey);
  searchUrl.searchParams.set("q", parsedBody.data.companyName);
  searchUrl.searchParams.set("par_page", "1");

  const searchData = await fetchPappersJson(searchUrl);
  const firstResult = getArray(searchData, "resultats").find(isJsonObject);
  const siren = getString(firstResult, ["siren"]);

  if (!siren) {
    return jsonError(
      "Aucune société trouvée pour ce nom.",
      404,
      "company_not_found",
    );
  }

  const companyUrl = new URL("https://api.pappers.fr/v2/entreprise");
  companyUrl.searchParams.set("api_token", apiKey);
  companyUrl.searchParams.set("siren", siren);

  const companyData = await fetchPappersJson(companyUrl);

  if (!companyData) {
    return jsonError(
      "Les informations société n’ont pas pu être récupérées.",
      502,
      "company_fetch_failed",
    );
  }

  const companyInfo = formatCompanyInfo(companyData);

  if (!companyInfo) {
    return jsonError(
      "Les informations société sont insuffisantes.",
      404,
      "company_data_incomplete",
    );
  }

  return NextResponse.json({
    success: true,
    companyInfo,
  });
}
