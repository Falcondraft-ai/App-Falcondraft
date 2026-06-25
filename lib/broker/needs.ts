import type { BrokerInsuranceType } from "@/lib/broker/clients";

export type NeedsQuestionType =
  | "text"
  | "number"
  | "select"
  | "boolean"
  | "textarea";

export type NeedsQuestion = {
  id: string;
  label: string;
  type: NeedsQuestionType;
  /** Options for `select` questions. */
  options?: string[];
  placeholder?: string;
  /** Unit suffix shown for number questions (e.g. "€", "km", "m²"). */
  unit?: string;
};

/**
 * Branch-specific "recueil de besoins" questionnaires. Answers are stored as a
 * flat `{ questionId: value }` map in broker_clients.structured_needs and feed
 * the devoir de conseil. Question ids are stable — never reuse one for another
 * meaning. Branches without a tailored set fall back to `genericNeeds`.
 */
const genericNeeds: NeedsQuestion[] = [
  {
    id: "objective",
    label: "Objectif du client",
    type: "textarea",
    placeholder: "Ce que le client souhaite couvrir ou obtenir.",
  },
  { id: "budget", label: "Budget indicatif", type: "number", unit: "€" },
  {
    id: "horizon",
    label: "Échéance / horizon",
    type: "text",
    placeholder: "Ex. souscription sous 1 mois",
  },
];

export const needsQuestionnaires: Record<
  BrokerInsuranceType,
  NeedsQuestion[]
> = {
  auto: [
    {
      id: "vehicle_type",
      label: "Type de véhicule",
      type: "select",
      options: ["Citadine", "Berline", "SUV / 4x4", "Utilitaire", "Moto", "Autre"],
    },
    {
      id: "vehicle_use",
      label: "Usage",
      type: "select",
      options: ["Privé", "Trajet domicile-travail", "Professionnel"],
    },
    { id: "annual_km", label: "Kilométrage annuel", type: "number", unit: "km" },
    {
      id: "license_years",
      label: "Ancienneté du permis",
      type: "number",
      unit: "ans",
    },
    {
      id: "claims_history",
      label: "Antécédents (sinistres 3 ans)",
      type: "select",
      options: ["Aucun", "1 sinistre", "2 sinistres ou plus"],
    },
    {
      id: "desired_coverage",
      label: "Formule souhaitée",
      type: "select",
      options: ["Au tiers", "Tiers +", "Tous risques"],
    },
    {
      id: "parking",
      label: "Stationnement habituel",
      type: "select",
      options: ["Garage privé", "Rue", "Parking collectif"],
    },
  ],
  habitation: [
    {
      id: "property_status",
      label: "Statut d’occupation",
      type: "select",
      options: ["Propriétaire occupant", "Propriétaire bailleur", "Locataire"],
    },
    {
      id: "dwelling_type",
      label: "Type de logement",
      type: "select",
      options: ["Appartement", "Maison"],
    },
    { id: "surface_m2", label: "Surface", type: "number", unit: "m²" },
    { id: "rooms", label: "Nombre de pièces principales", type: "number" },
    {
      id: "contents_value",
      label: "Valeur du mobilier à assurer",
      type: "number",
      unit: "€",
    },
    {
      id: "security",
      label: "Dispositifs de sécurité",
      type: "select",
      options: ["Aucun", "Alarme", "Porte blindée", "Gardiennage"],
    },
  ],
  sante: [
    {
      id: "family_composition",
      label: "Composition du foyer",
      type: "select",
      options: ["Seul", "Couple", "Famille avec enfants"],
    },
    { id: "beneficiaries", label: "Nombre de bénéficiaires", type: "number" },
    {
      id: "current_coverage",
      label: "Mutuelle actuelle",
      type: "text",
      placeholder: "Organisme et formule actuels",
    },
    {
      id: "priorities",
      label: "Postes prioritaires",
      type: "textarea",
      placeholder: "Optique, dentaire, hospitalisation, médecines douces…",
    },
    {
      id: "regular_care",
      label: "Soins réguliers / besoins particuliers",
      type: "textarea",
    },
  ],
  prevoyance: [
    {
      id: "professional_status",
      label: "Statut professionnel",
      type: "select",
      options: ["Salarié", "Travailleur non salarié (TNS)", "Fonctionnaire", "Retraité"],
    },
    { id: "dependents", label: "Personnes à charge", type: "number" },
    {
      id: "income_to_cover",
      label: "Revenu à couvrir",
      type: "number",
      unit: "€/mois",
    },
    {
      id: "objectives",
      label: "Objectifs",
      type: "textarea",
      placeholder: "Maintien de revenu, capital décès, rente conjoint, rente éducation…",
    },
    { id: "existing_cover", label: "Couverture existante", type: "text" },
  ],
  emprunteur: [
    { id: "loan_amount", label: "Montant emprunté", type: "number", unit: "€" },
    {
      id: "loan_duration_years",
      label: "Durée du prêt",
      type: "number",
      unit: "ans",
    },
    {
      id: "loan_type",
      label: "Type de prêt",
      type: "select",
      options: ["Immobilier", "Consommation", "Professionnel"],
    },
    { id: "lender", label: "Établissement prêteur", type: "text" },
    { id: "coverage_quotity", label: "Quotité à assurer", type: "number", unit: "%" },
    {
      id: "health_questionnaire",
      label: "Questionnaire de santé requis",
      type: "boolean",
    },
  ],
  pro: [
    { id: "activity", label: "Activité de l’entreprise", type: "text" },
    {
      id: "legal_form",
      label: "Forme juridique",
      type: "select",
      options: ["EI", "SARL", "SAS", "SCI", "Autre"],
    },
    { id: "employees", label: "Nombre de salariés", type: "number" },
    {
      id: "turnover",
      label: "Chiffre d’affaires annuel",
      type: "number",
      unit: "€",
    },
    {
      id: "needs",
      label: "Garanties recherchées",
      type: "textarea",
      placeholder: "RC Pro, multirisque, décennale, cyber, perte d’exploitation…",
    },
  ],
  epargne: [
    {
      id: "objective",
      label: "Objectif d’épargne",
      type: "select",
      options: ["Constitution de capital", "Préparation retraite", "Transmission", "Projet à terme"],
    },
    {
      id: "monthly_capacity",
      label: "Capacité d’épargne mensuelle",
      type: "number",
      unit: "€/mois",
    },
    { id: "initial_amount", label: "Versement initial", type: "number", unit: "€" },
    {
      id: "risk_profile",
      label: "Profil de risque",
      type: "select",
      options: ["Prudent", "Équilibré", "Dynamique"],
    },
    { id: "horizon", label: "Horizon de placement", type: "text" },
  ],
  autre: genericNeeds,
};

export function getNeedsQuestions(
  branch: string | null | undefined,
): NeedsQuestion[] {
  if (!branch) return genericNeeds;
  return needsQuestionnaires[branch as BrokerInsuranceType] ?? genericNeeds;
}

/** Normalises a raw structured_needs value into a string map. */
export function normalizeNeedsData(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === null || raw === undefined) continue;
    if (typeof raw === "string") {
      if (raw.trim()) out[key] = raw.trim();
    } else if (typeof raw === "number" || typeof raw === "boolean") {
      out[key] = String(raw);
    }
  }
  return out;
}

function displayValue(question: NeedsQuestion, raw: string): string {
  if (question.type === "boolean") {
    return raw === "true" || raw === "Oui" ? "Oui" : "Non";
  }
  if (question.unit && question.type === "number") {
    return `${raw} ${question.unit}`;
  }
  return raw;
}

/**
 * Returns "Label : value" lines for the answered questions of a dossier,
 * used to enrich the devoir de conseil. Skips empty answers.
 */
export function summarizeStructuredNeeds(
  branch: string | null | undefined,
  data: unknown,
): string[] {
  const answers = normalizeNeedsData(data);
  const questions = getNeedsQuestions(branch);
  const lines: string[] = [];
  for (const question of questions) {
    const value = answers[question.id];
    if (value === undefined || value === "") continue;
    lines.push(`- ${question.label} : ${displayValue(question, value)}`);
  }
  return lines;
}

/** Count of answered questions, for the dossier completeness hint. */
export function countAnsweredNeeds(
  branch: string | null | undefined,
  data: unknown,
): { answered: number; total: number } {
  const answers = normalizeNeedsData(data);
  const questions = getNeedsQuestions(branch);
  const answered = questions.filter(
    (q) => answers[q.id] !== undefined && answers[q.id] !== "",
  ).length;
  return { answered, total: questions.length };
}
