export type AdminMetric = {
  label: string;
  value: string;
  detail: string;
};

export type AdminRow = {
  id: string;
  name: string;
  status: string;
  detail: string;
  updatedAt: string;
};

export const adminMetrics: AdminMetric[] = [
  {
    label: "Organisations",
    value: "18",
    detail: "3 espaces en configuration",
  },
  {
    label: "Utilisateurs",
    value: "74",
    detail: "9 invitations en attente",
  },
  {
    label: "Opportunités",
    value: "312",
    detail: "27 actives cette semaine",
  },
  {
    label: "Générations échouées",
    value: "5",
    detail: "À qualifier manuellement",
  },
];

export const adminOrganizations: AdminRow[] = [
  {
    id: "org-atelier-archipel",
    name: "Atelier Archipel",
    status: "Actif",
    detail: "12 opportunités",
    updatedAt: "2026-05-06T15:48:00.000Z",
  },
  {
    id: "org-studio-lignage",
    name: "Studio Lignage",
    status: "Configuration",
    detail: "Connexion email à finaliser",
    updatedAt: "2026-05-05T10:06:00.000Z",
  },
  {
    id: "org-bureau-cobalt",
    name: "Bureau Cobalt",
    status: "Actif",
    detail: "Document final prêt",
    updatedAt: "2026-05-04T17:25:00.000Z",
  },
];

export const adminWorkflowRuns: AdminRow[] = [
  {
    id: "run-7841",
    name: "Proposition — Rivage Conseil",
    status: "En cours",
    detail: "Structuration du périmètre",
    updatedAt: "2026-05-06T09:30:00.000Z",
  },
  {
    id: "run-7732",
    name: "Document final — Bureau Cobalt",
    status: "Terminé",
    detail: "PDF prêt",
    updatedAt: "2026-05-04T17:25:00.000Z",
  },
  {
    id: "run-7650",
    name: "Brouillon email — Nord Ouvrage",
    status: "Terminé",
    detail: "Message préparé",
    updatedAt: "2026-05-03T11:15:00.000Z",
  },
];

export const adminFailedGenerations: AdminRow[] = [
  {
    id: "fail-204",
    name: "Proposition — Groupe Méridien",
    status: "À revoir",
    detail: "Contexte insuffisant",
    updatedAt: "2026-05-06T08:40:00.000Z",
  },
  {
    id: "fail-198",
    name: "Document final — Cabinet Orée",
    status: "Relancé",
    detail: "Validation expirée",
    updatedAt: "2026-05-05T18:14:00.000Z",
  },
];
