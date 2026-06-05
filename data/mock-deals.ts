import type { Deal, DealStatus } from "@/types/deal";

export const mockDeals: Deal[] = [
  {
    id: "opp-archipel-gare",
    name: "Concours restructuration gare fluviale",
    clientCompanyName: "Atelier Archipel",
    clientContactName: "Marion Delvaux",
    clientEmail: "marion.delvaux@atelier-archipel.fr",
    clientPhone: "+33 1 84 27 63 18",
    status: "validation_pending",
    createdAt: "2026-04-22T09:12:00.000Z",
    updatedAt: "2026-05-06T15:48:00.000Z",
    lastAction: "Proposition relue par la direction projet",
    amountEstimate: 48200,
    ownerName: "Clémence Varlet",
    priority: "important",
    expectedCloseDate: "2026-05-24T00:00:00.000Z",
    source: "Compte-rendu d’appel du 22 avril",
    transcript:
      "Le client souhaite une réponse claire pour un concours en deux phases. Les références doivent être filtrées par équipements publics, avec une attention particulière au phasage chantier et à la coordination des bureaux d’études.",
    additionalContext:
      "Insister sur la capacité à transformer un programme encore mouvant en dossier maîtrisé. Éviter les promesses trop larges ; privilégier méthode, rythme de validation et qualité documentaire.",
    emailInstructions:
      "Ton sobre, direct, avec une ouverture sur un point de cadrage de 30 minutes.",
    hasTranscript: true,
    hasCallSummary: true,
    hasProposal: true,
    callSummary:
      "Atelier Archipel prépare une réponse à concours nécessitant un dossier très contrôlé : références publiques, méthodologie de coordination, calendrier de validation et annexes financières cohérentes.",
    proposalTitle: "Accompagnement proposition — Gare fluviale",
    proposalExcerpt:
      "La proposition structure la réponse autour de trois leviers : clarification du récit projet, consolidation des références pertinentes et production d’un dossier final homogène.",
    finalDocumentName: "Proposition_Atelier_Archipel_Gare_Fluviale.pdf",
    signatureUrl: "https://signature.falcondraft.local/archipel-gare",
    emailDraft: {
      subject: "Proposition FalconDraft — réponse gare fluviale",
      body: "Bonjour Marion,\n\nVous trouverez ci-joint notre proposition pour structurer et finaliser votre réponse au concours de la gare fluviale.\n\nNous pouvons prévoir un point court cette semaine pour ajuster le périmètre avant validation.\n\nBien cordialement,\nFalconDraft",
    },
  },
  {
    id: "opp-studio-lignage",
    name: "Offre cadre — rénovation tertiaire",
    clientCompanyName: "Studio Lignage",
    clientContactName: "Romain Castella",
    clientEmail: "romain.castella@studiolignage.fr",
    clientPhone: "+33 4 72 18 41 09",
    status: "proposal_ready",
    createdAt: "2026-04-28T13:20:00.000Z",
    updatedAt: "2026-05-05T10:06:00.000Z",
    lastAction: "Proposition générée, validation attendue",
    amountEstimate: 31800,
    ownerName: "Noémie Abadie",
    priority: "standard",
    expectedCloseDate: "2026-05-19T00:00:00.000Z",
    source: "Notes atelier commercial",
    transcript:
      "Le cabinet veut industrialiser ses réponses pour des rénovations tertiaires entre 1 500 et 5 000 m². Les documents existants sont bons mais dispersés entre anciennes propositions et références PDF.",
    additionalContext:
      "Mettre en avant la réutilisation contrôlée des contenus et la réduction du temps de montage des dossiers.",
    emailInstructions:
      "Message court, orienté bénéfice opérationnel et rigueur.",
    hasTranscript: true,
    hasCallSummary: true,
    hasProposal: true,
    callSummary:
      "Studio Lignage cherche une méthode reproductible pour produire des offres de rénovation tertiaire sans repartir de fichiers dispersés à chaque opportunité.",
    proposalTitle: "Système de proposition — rénovation tertiaire",
    proposalExcerpt:
      "Le dispositif proposé consolide les contenus réutilisables, formalise les variantes par typologie de projet et prépare un flux de validation simple.",
    finalDocumentName: "Proposition_Studio_Lignage_Renovation.pdf",
    signatureUrl: "https://signature.falcondraft.local/studio-lignage",
    emailDraft: {
      subject: "Votre proposition FalconDraft pour Studio Lignage",
      body: "Bonjour Romain,\n\nLa proposition est prête pour relecture. Elle reprend les enjeux évoqués : capitaliser sur vos références et réduire le temps de production des offres récurrentes.\n\nBien cordialement,\nFalconDraft",
    },
  },
  {
    id: "opp-cobalt-methodologie",
    name: "Méthodologie AMO — campus santé",
    clientCompanyName: "Bureau Cobalt",
    clientContactName: "Sofia El Harti",
    clientEmail: "sofia.elharti@bureau-cobalt.fr",
    status: "final_document_ready",
    createdAt: "2026-04-17T08:34:00.000Z",
    updatedAt: "2026-05-04T17:25:00.000Z",
    lastAction: "Document final prêt à télécharger",
    amountEstimate: 64750,
    ownerName: "Clémence Varlet",
    priority: "urgent",
    expectedCloseDate: "2026-05-10T00:00:00.000Z",
    source: "Entretien de qualification",
    transcript:
      "Le dossier porte sur une mission AMO avec beaucoup de parties prenantes. Le client veut un document ferme, très lisible, qui rassure sur la gouvernance et les jalons.",
    additionalContext:
      "Conserver un ton institutionnel. Éviter toute formulation trop commerciale.",
    emailInstructions:
      "Email formel, mentionner que le document final intègre les ajustements du 3 mai.",
    hasTranscript: true,
    hasCallSummary: true,
    hasProposal: true,
    callSummary:
      "Bureau Cobalt a besoin d’un dossier AMO crédible pour un campus santé, avec une attention forte à la gouvernance, aux jalons et aux responsabilités de coordination.",
    proposalTitle: "Méthodologie AMO — campus santé",
    proposalExcerpt:
      "La proposition clarifie le pilotage, la matrice de responsabilités et les livrables attendus à chaque étape de la mission.",
    finalDocumentName: "Document_final_Bureau_Cobalt_Campus_Sante.pdf",
    signatureUrl: "https://signature.falcondraft.local/cobalt-campus",
    emailDraft: {
      subject: "Document final — mission AMO campus santé",
      body: "Bonjour Sofia,\n\nLe document final est prêt. Il intègre les ajustements validés le 3 mai, notamment la gouvernance et le séquencement des livrables.\n\nBien cordialement,\nFalconDraft",
    },
  },
  {
    id: "opp-nord-ouvrage",
    name: "Dossier offre — maîtrise d’œuvre logements",
    clientCompanyName: "Nord Ouvrage",
    clientContactName: "Élise Garnier",
    clientEmail: "elise.garnier@nordouvrage.fr",
    clientPhone: "+33 3 20 74 59 31",
    status: "email_draft_ready",
    createdAt: "2026-04-11T14:42:00.000Z",
    updatedAt: "2026-05-03T11:15:00.000Z",
    lastAction: "Brouillon email préparé",
    amountEstimate: 27600,
    ownerName: "Noémie Abadie",
    priority: "standard",
    expectedCloseDate: "2026-05-13T00:00:00.000Z",
    source: "Brief client et documents existants",
    transcript:
      "L’équipe veut gagner du temps sur les offres logement répétitives, mais conserver une adaptation réelle aux programmes et aux contraintes locales.",
    additionalContext:
      "Mettre en avant la précision des variantes plutôt que la vitesse seule.",
    emailInstructions:
      "Prévoir un email d’envoi simple avec mention du lien de signature.",
    hasTranscript: true,
    hasCallSummary: true,
    hasProposal: true,
    callSummary:
      "Nord Ouvrage veut fiabiliser la production de dossiers de maîtrise d’œuvre logement sans donner l’impression d’un modèle générique.",
    proposalTitle: "Production contrôlée de dossiers logement",
    proposalExcerpt:
      "Le système proposé organise les contenus par typologie, contraintes locales et niveau de personnalisation attendu.",
    finalDocumentName: "Document_final_Nord_Ouvrage_Logements.pdf",
    signatureUrl: "https://signature.falcondraft.local/nord-ouvrage",
    emailDraft: {
      subject: "Document final et lien de signature — Nord Ouvrage",
      body: "Bonjour Élise,\n\nLe document final est prêt. Vous trouverez également le lien de signature pour valider le lancement de l’accompagnement.\n\nBien cordialement,\nFalconDraft",
    },
  },
  {
    id: "opp-rivage-conseil",
    name: "Proposition conseil — réponse appel d’offres",
    clientCompanyName: "Rivage Conseil",
    clientContactName: "Adrien Malesherbes",
    clientEmail: "adrien.malesherbes@rivage-conseil.fr",
    status: "proposal_generating",
    createdAt: "2026-05-01T16:05:00.000Z",
    updatedAt: "2026-05-06T09:30:00.000Z",
    lastAction: "Proposition en cours de préparation",
    amountEstimate: 18900,
    ownerName: "Clémence Varlet",
    priority: "important",
    expectedCloseDate: "2026-05-21T00:00:00.000Z",
    source: "Transcript d’appel",
    transcript:
      "Rivage Conseil répond à un appel d’offres avec une forte contrainte de délai. Le besoin porte sur une proposition structurée, chiffrée et cohérente avec leur positionnement premium.",
    additionalContext:
      "La proposition doit rester pragmatique et éviter les promesses trop ambitieuses.",
    emailInstructions:
      "Demander validation sur le périmètre avant génération du document final.",
    hasTranscript: true,
    hasCallSummary: true,
    hasProposal: true,
    callSummary:
      "Rivage Conseil veut produire rapidement une proposition complète, sans sacrifier la cohérence du périmètre et du chiffrage.",
    proposalTitle: "Accompagnement réponse appel d’offres",
    proposalExcerpt:
      "La proposition organise le contenu autour du contexte, du périmètre, des livrables et d’un calendrier de validation resserré.",
    finalDocumentName: "Proposition_Rivage_Conseil_Appel_Offres.pdf",
    signatureUrl: "https://signature.falcondraft.local/rivage-conseil",
    emailDraft: {
      subject: "Validation du périmètre — proposition Rivage Conseil",
      body: "Bonjour Adrien,\n\nLa proposition est en cours de préparation. Nous vous adresserons une version de validation avant création du document final.\n\nBien cordialement,\nFalconDraft",
    },
  },
  {
    id: "opp-maison-graphite",
    name: "Système commercial — offres design global",
    clientCompanyName: "Maison Graphite",
    clientContactName: "Laure Ménard",
    clientEmail: "laure.menard@maison-graphite.fr",
    status: "completed",
    createdAt: "2026-03-29T10:18:00.000Z",
    updatedAt: "2026-04-30T16:40:00.000Z",
    lastAction: "Opportunité terminée",
    amountEstimate: 52200,
    ownerName: "Noémie Abadie",
    priority: "standard",
    expectedCloseDate: "2026-04-29T00:00:00.000Z",
    source: "Atelier cadrage",
    transcript:
      "Maison Graphite souhaite un espace de production commerciale pour structurer des offres design global, avec plusieurs niveaux d’accompagnement.",
    additionalContext:
      "Client sensible à la qualité de présentation et à la cohérence narrative.",
    emailInstructions:
      "Rester concis. Confirmer la disponibilité du document signé.",
    hasTranscript: true,
    hasCallSummary: true,
    hasProposal: true,
    callSummary:
      "Maison Graphite a validé la mise en place d’un système de propositions par niveau d’accompagnement.",
    proposalTitle: "Système commercial — offres design global",
    proposalExcerpt:
      "Le dispositif final distingue trois niveaux d’offre et clarifie les livrables associés.",
    finalDocumentName: "Document_final_Maison_Graphite.pdf",
    signatureUrl: "https://signature.falcondraft.local/maison-graphite",
    emailDraft: {
      subject: "Document signé — Maison Graphite",
      body: "Bonjour Laure,\n\nLe document signé est disponible dans votre espace. Merci pour votre confiance.\n\nBien cordialement,\nFalconDraft",
    },
  },
];

export const dealStatusOptions: Array<{ value: DealStatus; label: string }> = [
  { value: "draft", label: "Brouillon" },
  { value: "call_summary_ready", label: "Compte-rendu prêt" },
  { value: "proposal_generating", label: "Proposition en cours" },
  { value: "proposal_ready", label: "Proposition prête" },
  { value: "validation_pending", label: "En attente de validation" },
  { value: "final_document_generating", label: "Document final en cours" },
  { value: "final_document_ready", label: "Document final prêt" },
  { value: "signature_ready", label: "Signature prête" },
  { value: "email_draft_ready", label: "Email prêt" },
  { value: "completed", label: "Terminé" },
  { value: "failed", label: "Erreur" },
];

export const dashboardChartData = [
  { month: "Jan", propositions: 12, documents: 8 },
  { month: "Fév", propositions: 15, documents: 11 },
  { month: "Mar", propositions: 18, documents: 13 },
  { month: "Avr", propositions: 22, documents: 16 },
  { month: "Mai", propositions: 17, documents: 14 },
] as const;

export function getDealById(id: string): Deal | undefined {
  return mockDeals.find((deal) => deal.id === id);
}
