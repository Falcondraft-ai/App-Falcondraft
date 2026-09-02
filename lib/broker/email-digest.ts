import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  brokerClientDisplayName,
  brokerInsuranceTypes,
  insuranceTypeLabel,
} from "@/lib/broker/clients";
import {
  resolveMailboxAddress,
  type OutlookMessage,
} from "@/lib/email/outlook-read";
import {
  type AttachmentDocCategory,
  isEmailCategory,
  normalizeAttachmentCategory,
} from "@/lib/broker/outlook";
import {
  isReadableDocument,
  understandDocument,
} from "@/lib/broker/document-understanding";
import {
  commonInsurerSuggestions,
  parseBrokerSettings,
} from "@/lib/broker/settings";
import { getMailboxClient } from "@/lib/email/mailbox-resolver";
import type { MailboxClient } from "@/lib/email/mailbox";
import type { BrokerClientRow, Database } from "@/types/database";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// High-volume email triage (runs daily per broker). Configurable via env so the
// model/cost can be tuned without a code change.
const DIGEST_MODEL = process.env.COURTIER_DIGEST_MODEL || "gpt-5.5";
// Emails read per run. A busy cabinet takes 100+/day, so the daily briefing has
// to swallow a full day comfortably, and a catch-up several weeks of backlog.
// Whatever does not fit is NOT dropped: the run stops on a precise timestamp and
// the next one resumes there (see `truncated` below).
const MAX_EMAILS = 200;
// Absolute safety bound on the rolling window: the briefing always resumes from
// the last one, however old it is (a broker can be away for weeks), but never
// asks Graph for a range beyond this.
const MAX_WINDOW_DAYS = 90;
// Emails classified in one OpenAI call. Bodies are ~2.5k chars each, so a whole
// backlog in a single request would blow past the context window and cost far
// more than several small, parallel calls.
// Emails classés en un appel. 25 tenaient dans le contexte, mais pas dans la
// RÉPONSE : vingt-cinq résumés, motifs et brouillons dépassent vite le plafond
// de sortie, et un JSON tronqué fait échouer le lot entier. Douze laisse de la
// marge et limite la casse quand un lot échoue.
const CLASSIFY_BATCH_SIZE = 12;
// Parallelism caps: Graph throttles (429) long before it runs out of breath, and
// OpenAI is rate-limited per minute.
const GRAPH_CONCURRENCY = 8;
const CLASSIFY_CONCURRENCY = 3;
// Reading attachment content (vision) is bounded to keep the daily briefing
// cheap and fast: only PDFs/images, capped in count and size. Beyond the cap,
// classification falls back to the file name.
const MAX_ATTACHMENTS_ANALYZED = 15;
/** Wider windows carry more documents; vision stays the costliest step. */
const BACKFILL_MAX_ATTACHMENTS_ANALYZED = 60;
const MAX_ATTACHMENT_ANALYZE_BYTES = 8 * 1024 * 1024;
// The classification reasons over what each email actually SAYS (who is the
// insured, which info to note or update, what changed) — Graph's ~250-char
// bodyPreview is not enough. Full bodies are fetched, bounded per email.
const MAX_BODY_CHARS = 2500;
// Manual "go back over the last N days" backfill: wider window + higher email
// cap than the daily rolling briefing (already-seen emails are still skipped).
const BACKFILL_MAX_DAYS = 90;
const BACKFILL_MAX_EMAILS = 600;
// Attachment kinds that ARE client documents — a mail carrying one is relevant
// on its own and its attachment must always be offered for filing.
/**
 * Marqueurs d'un expéditeur qu'aucun humain ne lit : automates et envois de
 * masse. Reconnus N'IMPORTE OÙ dans la partie locale, séparés par un tiret, un
 * point ou un underscore — les plateformes préfixent presque toujours
 * (`messages-noreply@`), et un motif ancré au début les manquait toutes.
 *
 * « newsletter » et « marketing » en font partie, mais UNIQUEMENT parce que le
 * garde-fou assureurs ci-dessous les rattrape : sans lui, une nouveauté produit
 * envoyée par une compagnie depuis `marketing@` serait perdue, et c'est une
 * information de métier pour un courtier.
 */
const BULK_SENDER_PATTERN =
  /(^|[-_.])(no[-_.]?reply|do[-_.]?not[-_.]?reply|donotreply|ne[-_.]?pas[-_.]?repondre|nepasrepondre|mailer[-_.]?daemon|postmaster|bounces?|newsletters?|mailing|marketing|campaign|unsubscribe|desabonnement)([-_.+]|$)/i;

/**
 * Domaines qui s'annoncent eux-mêmes comme métier de l'assurance. Premier
 * garde-fou, indépendant des données du cabinet.
 */
const INSURANCE_DOMAIN_PATTERN =
  /assur|mutuel|pr[ée]voyance|courtage|courtier|insurance/i;

const CLIENT_DOC_CATEGORIES = new Set<AttachmentDocCategory>([
  "company_quote",
  "contract",
  "rib",
  "id_document",
]);

export type DigestContext = {
  adminSupabase: SupabaseClient<Database>;
  organizationId: string;
  userId: string;
  userName: string;
  /**
   * Profil de cabinet dont on traite la boîte. Sur un compte partagé, c'est LUI
   * qui distingue les briefings : sans lui, tout le cabinet se partagerait un
   * seul fil de courrier et le pointeur de reprise de l'un écraserait l'autre.
   */
  profileId?: string | null;
};

export type GenerateDigestResult =
  | {
      success: true;
      digestId: string;
      relevant: number;
      excluded: number;
      uncertain: number;
      /**
       * The window was cut short by the email cap: older mail is still waiting
       * and the next run resumes exactly where this one stopped. The UI invites
       * the broker to relaunch rather than letting him believe he is up to date.
       */
      truncated: boolean;
    }
  | { success: false; reason: string; message: string };

type AttachmentRef = {
  ref: string;
  messageId: string;
  attachmentId: string;
  name: string;
  contentType: string;
  size: number;
};

/** What an attachment actually is, from reading its content (vision). */
type AttachmentUnderstanding = {
  category: AttachmentDocCategory;
  label: string;
  summary: string;
  subject_name: string | null;
};

type AiAction = {
  type?: string;
  attachment_ref?: string;
  document_category?: string;
  subject?: string;
  body?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  date_of_birth?: string;
  birth_country?: string;
  insurance_type?: string;
  needs?: string;
  claim_type?: string;
  description?: string;
  note?: string;
  /** For create_client: whether the email sender is the insured client. */
  subject_is_sender?: boolean;
};

type AiEmailResult = {
  ref?: string;
  relevance?: string; // "yes" | "no" | "uncertain"
  reason?: string;
  category?: string;
  summary?: string;
  urgency?: string;
  /** How the AI classifies the sender relative to the cabinet. */
  sender_type?: string;
  /** Ref (c0, c1…) of the existing dossier this email concerns, or null. */
  matched_client_ref?: string | null;
  /** Legacy hint kept as a fallback matcher. */
  client_match_email?: string | null;
  actions?: AiAction[];
};

type AiResponse = {
  narrative?: string;
  emails?: AiEmailResult[];
};

/** One client of the portfolio, exposed to the AI with a stable short ref. */
type RosterEntry = {
  ref: string;
  name: string;
  type: "particulier" | "entreprise";
  email: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  branch: string | null;
};

/**
 * Keeps a birth date only when it is a real ISO day. Anything else the model
 * may return ("né en 1980", "12/03/1980") is dropped rather than stored wrong —
 * a false date of birth on a dossier is worse than an empty field.
 */
function normalizeBirthDate(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === raw ? raw : null;
}

function buildSystemPrompt(userName: string, mailboxAddresses: string[]): string {
  const addressBlock =
    mailboxAddresses.length > 1
      ? [
          ``,
          `ADRESSES DU CABINET : cette boîte Outlook regroupe plusieurs adresses de réception : ${mailboxAddresses.join(", ")}.`,
          `Chaque email indique "received_on" = l'adresse du cabinet sur laquelle il est arrivé. Une adresse peut correspondre à une activité, une marque ou un canal différent : utilise ce contexte pour mieux trier (ex. une adresse dédiée aux sinistres, une autre aux prospects). Ne mélange pas les canaux.`,
        ]
      : [];
  return [
    `Tu es l'assistant de tri du courrier d'un cabinet de courtage en assurance. Tu travailles pour ${userName}.`,
    `On te donne les emails reçus récemment dans sa boîte Outlook, et TOUT son portefeuille clients (known_clients), chaque dossier ayant un identifiant court "ref" (c0, c1, …).`,
    `Chaque email inclut son CONTENU COMPLET dans "body" (éventuellement tronqué). Lis-le vraiment avant de trier : c'est là que se trouvent l'assuré concerné, les coordonnées transmises, l'objet à assurer et ses caractéristiques.`,
    ...addressBlock,
    ``,
    `TON RÔLE : produire un briefing du jour utile et RÉELLEMENT trié.`,
    ``,
    `RÈGLE DE PERTINENCE (la plus importante) — pour chaque email, "relevance" vaut "yes", "no" ou "uncertain" :`,
    `- "yes" : email clairement en lien avec l'activité de courtage en assurance —`,
    `  demandes de clients/prospects, devis de compagnies, contrats/souscriptions, sinistres, échéances/renouvellements, factures liées à l'activité, échanges avec des assureurs.`,
    `- "no" : clairement SANS lien — publicités, newsletters, notifications de plateformes, réseaux sociaux, démarchage, spam, emails personnels, relevés non liés, etc.`,
    `- "uncertain" : cas SUBTIL/AMBIGU où tu hésites vraiment (ex. expéditeur inconnu au sujet vague, email pro mais pas sûr qu'il s'agisse d'assurance). N'invente pas : si tu hésites, mets "uncertain" pour que le courtier tranche, plutôt que de deviner.`,
    `- Renseigne toujours "reason" : une phrase TRÈS courte expliquant pourquoi (surtout pour "no" et "uncertain").`,
    `- Ne propose des "actions" QUE pour "yes" ou "uncertain" (jamais pour "no").`,
    ``,
    `ACTIONS — ne propose une action QUE si elle a un sens évident après avoir lu le contenu :`,
    `- attach_document : TOUTE pièce jointe qui est un document client DOIT être rangée. Quand une pièce jointe a un "detected_type" (son contenu a été lu), REPRENDS-le comme document_category — il reflète le contenu réel, pas le nom du fichier. Si detected_type ∈ company_quote|contract|rib|id_document, propose TOUJOURS attach_document pour elle, MÊME si le corps de l'email n'en parle pas (ex. un passeport envoyé sans texte = id_document à ranger). Le champ "concerns" de la pièce jointe identifie souvent le client : utilise-le pour matched_client_ref. Si aucun dossier ne correspond, propose quand même attach_document (le courtier choisira le dossier).`,
    `- draft_reply : seulement si l'email appelle clairement une réponse. Rédige un brouillon court, professionnel, en français, prêt à relire (jamais de promesse ferme).`,
    `- create_client : UNIQUEMENT s'il faut ouvrir un dossier pour un vrai prospect/client ASSURÉ qui ne correspond à AUCUN client existant. JAMAIS pour un assureur, un fournisseur, une plateforme, une pub.`,
    `  • Le dossier est au nom de la personne/entreprise ASSURÉE, PAS forcément l'expéditeur. Un email peut venir d'un apporteur, d'un collègue, de la boîte du cabinet, ou d'un intermédiaire qui PARLE d'un tiers : dans ce cas le client est ce tiers (nom lu dans le corps du mail ou les pièces jointes) et tu mets subject_is_sender=false.`,
    `  • Renseigne first_name/last_name (ou company_name) du CLIENT. Pour email, mets l'email DU CLIENT si tu le connais ; si le client n'est pas l'expéditeur et que tu n'as pas son email, laisse email vide — n'utilise JAMAIS l'email de l'expéditeur pour un tiers. Ajoute la branche probable (${brokerInsuranceTypes.join(", ")}).`,
    `  • NOM EXACT — RÈGLE STRICTE : reprends le nom EXACTEMENT tel qu'il apparaît (nom de l'expéditeur, signature ou corps). N'invente, n'ajoute et ne complète JAMAIS un prénom, un deuxième prénom, une particule ou un nom absent. Ex. « Timeo Marcopoulos » → first_name="Timeo", last_name="Marcopoulos" (JAMAIS « Timeo François Marcopoulos »). Ne déduis pas de prénom à partir d'une adresse email. En cas de doute, mets moins plutôt que d'inventer.`,
    `  • COORDONNÉES — chaque information d'identité présente dans l'email va dans SON champ, jamais dans le texte libre : phone, address, postal_code, city, date_of_birth (format strict AAAA-MM-JJ), birth_country. Ce sont les champs du dossier ; ne les recopie pas dans "needs".`,
    `  • Renseigne TOUJOURS "needs" avec l'objet à assurer et TOUTES ses caractéristiques utiles + le contexte de la demande (ex. « Scooter 50 cm³ Cibès à assurer », véhicule + marque/modèle/immatriculation, logement + surface + adresse DU RISQUE, date d'effet souhaitée). C'est ce qui remplit la NOTE interne du nouveau dossier — sois complet et factuel, mais SANS les coordonnées ci-dessus.`,
    `  • Si l'expéditeur EST lui-même le client assuré, mets subject_is_sender=true.`,
    `  • N'ouvre jamais un dossier au nom du courtier (${userName}) ni d'un membre du cabinet.`,
    `  • DÈS QU'un email décrit une nouvelle demande d'assurance pour une personne/entreprise NOMMÉE qui n'a pas encore de dossier, tu DOIS proposer create_client pour elle — même si l'email vient d'un tiers/apporteur/collègue, et même quand tu proposes aussi un draft_reply pour réclamer les infos manquantes. Ne te contente jamais du seul brouillon de réponse : ouvre le dossier ET rédige la réponse.`,
    `  • Exemple : email de Jean (apporteur) « nouvelle demande d'assurance habitation pour Mme Cassandra Mitchel, appartement 120 m² ». → actions : create_client { subject_is_sender:false, first_name:"Cassandra", last_name:"Mitchel", insurance_type:"immobilier", needs:"Assurance habitation — appartement 120 m²" } ET draft_reply pour demander les informations nécessaires au devis.`,
    `- update_client : DÈS QU'un email concerne un dossier EXISTANT (matched_client_ref non nul) et fournit une coordonnée (email, téléphone, adresse, code postal, ville, date de naissance au format AAAA-MM-JJ, pays de naissance) ABSENTE ou DIFFÉRENTE du dossier connu, tu DOIS proposer update_client sur ce dossier — que l'info vienne du client lui-même OU d'un tiers/apporteur qui la transmet. C'est le cœur du CRM : tenir chaque dossier à jour. Renseigne les champs fournis qui manquent ou diffèrent de known_clients (compare aux valeurs du dossier) ; n'inclus pas un champ identique à l'existant, et n'invente jamais. Cette action s'ajoute à un éventuel accusé de réception (draft_reply).`,
    `- add_note : DÈS QU'un email concernant un dossier EXISTANT (matched_client_ref non nul) apporte une INFORMATION IMPORTANTE à conserver qui n'est pas une simple coordonnée — l'objet à assurer et ses caractéristiques (ex. « scooter 50 cm³ Cibès », véhicule + marque/modèle/immatriculation, logement + surface + adresse du risque), la situation (composition familiale, profession, antériorité d'assurance, antécédents), une échéance/date d'effet souhaitée, une décision, une préférence ou une demande précise. Résume-la dans "note" de façon COURTE, FACTUELLE et complète (reprends les chiffres et détails utiles). Ces informations doivent atterrir dans la note interne du dossier. N'utilise PAS add_note pour une simple coordonnée (ça, c'est update_client) ni pour un dossier inexistant (mets l'info dans needs de create_client).`,
    `- declare_claim : seulement si l'email évoque un sinistre concret (dégât, accident, vol...). Donne claim_type et une courte description.`,
    `- flag_renewal : seulement si l'email mentionne une échéance/résiliation/renouvellement de contrat.`,
    ``,
    `RAISONNEMENT SUR LE PORTEFEUILLE — fais-le pour CHAQUE email AVANT de décider des actions :`,
    `1) Qui écrit ? Recoupe l'expéditeur (nom + email + téléphone) avec known_clients. Un client peut écrire depuis une autre adresse : compare aussi le NOM et le contenu, pas seulement l'email. Ne te limite pas à une égalité d'adresse.`,
    `2) De qui parle l'email ? La personne ASSURÉE concernée n'est pas toujours l'expéditeur (apporteur, collègue, proche, plateforme qui transmet un lead, le cabinet lui-même).`,
    `3) Classe l'expéditeur dans "sender_type" : existing_client | prospect | insurer | partner | provider | internal | other. (insurer = compagnie/assureur ; partner = apporteur/partenaire ; provider = fournisseur/prestataire/plateforme ; internal = ${userName} ou un membre du cabinet.)`,
    `4) RATTACHEMENT : si l'email concerne un dossier déjà présent dans known_clients, mets "matched_client_ref" = le ref de CE dossier (ex. "c3"). Sinon "matched_client_ref": null. Attention : un mail d'un client connu QUI PARLE d'un TIERS concerne le tiers, pas l'expéditeur — matched_client_ref = le dossier du tiers s'il existe, sinon null.`,
    `5) DÉCISION dossier : matched_client_ref null + vrai prospect/demande d'assurance pour une personne nommée → propose create_client pour ELLE. matched_client_ref non nul → PAS de create_client ; propose plutôt update_client / attach_document / draft_reply sur ce dossier. sender_type ∈ insurer|provider|internal|other → en général AUCUN create_client.`,
    ``,
    `SCÉNARIOS COURANTS — applique le JEU d'actions correspondant (souvent plusieurs actions pour un même email). Ne te contente jamais d'une seule action si plusieurs sont utiles :`,
    `- Prospect qui se présente lui-même (aucun dossier) → create_client (subject_is_sender=true) [+ draft_reply si des infos manquent].`,
    `- Demande transmise par un tiers/apporteur pour une personne SANS dossier → create_client (subject_is_sender=false, infos de l'assuré) [+ draft_reply].`,
    `- Coordonnées d'un client EXISTANT transmises (par lui-même OU par un tiers) → matched_client_ref = son dossier + update_client (email/téléphone/adresse fournis) [+ draft_reply d'accusé de réception].`,
    `- Info substantielle sur un client EXISTANT (objet à assurer + caractéristiques, situation, échéance, préférence) → matched_client_ref + add_note (résumé factuel) [+ update_client si une coordonnée change, + draft_reply si une réponse est attendue].`,
    `- Client existant qui écrit (question, envoi de pièce) → matched_client_ref + attach_document si pièce jointe utile + add_note si l'email contient une info à garder + draft_reply si une réponse est attendue.`,
    `- Devis/contrat/RIB/pièce d'identité en pièce jointe → attach_document sur le bon dossier (catégorie = detected_type).`,
    `- Sinistre concret évoqué → declare_claim. Échéance/résiliation/renouvellement → flag_renewal.`,
    `- Assureur / fournisseur / plateforme / interne (${userName}) → jamais de create_client ; propose seulement une action si elle est vraiment utile.`,
    `Exemple : « ${userName} transmet les coordonnées de Cécilia Bono (email, téléphone, adresse) », Cécilia a déjà un dossier (c5) → actions : update_client { phone, email, address, postal_code, city } sur c5 (matched_client_ref="c5") + draft_reply d'accusé de réception à l'expéditeur. PAS de create_client.`,
    ``,
    `NARRATIF : rédige "narrative" = 2 à 4 phrases, ton chaleureux et professionnel, qui raconte l'essentiel de la matinée ("Ce matin, ..."), met en avant l'urgent. Pas d'emojis, pas de jargon technique.`,
    ``,
    `Réponds STRICTEMENT en JSON valide correspondant au schéma demandé. N'invente pas de pièces jointes : n'utilise que les attachment_ref fournis.`,
  ].join("\n");
}

function buildUserPayload(
  offset: number,
  messages: OutlookMessage[],
  attachmentsByMessage: Map<string, AttachmentRef[]>,
  clientRoster: RosterEntry[],
  mailboxByMessage: Map<string, string | null>,
  understoodByRef: Map<string, AttachmentUnderstanding>,
  bodyByMessage: Map<string, string>,
): string {
  // Le rang GLOBAL, pas le rang dans le lot : les références des pièces jointes
  // (`e12a0`) sont calculées sur l'ensemble des emails, et deux lots qui
  // repartiraient de `e0` verraient leurs verdicts se recouvrir — le résumé de
  // l'un atterrissant sur l'autre.
  const emails = messages.map((m, local) => ({
    ref: `e${offset + local}`,
    from_name: m.fromName,
    from_email: m.fromEmail,
    subject: m.subject,
    received_at: m.receivedDateTime,
    received_on: mailboxByMessage.get(m.id) ?? null,
    // Full body when it could be fetched (truncated), else the short preview.
    body: bodyByMessage.get(m.id) ?? m.bodyPreview,
    attachments: (attachmentsByMessage.get(m.id) ?? []).map((a) => {
      const u = understoodByRef.get(a.ref);
      return {
        ref: a.ref,
        name: a.name,
        content_type: a.contentType,
        // Content read automatically (when readable) → trust over the file name.
        ...(u
          ? {
              detected_type: u.category,
              content_label: u.label,
              content_summary: u.summary,
              concerns: u.subject_name,
            }
          : {}),
      };
    }),
  }));

  return JSON.stringify({
    instructions: "Trie ces emails et propose les actions pertinentes.",
    known_clients: clientRoster,
    emails,
    expected_schema: {
      narrative: "string",
      emails: [
        {
          ref: "e0",
          relevance: "yes|no|uncertain",
          reason: "string",
          category:
            "prospect|client_request|quote|contract|claim|renewal|invoice|other_broker",
          summary: "string",
          urgency: "normal|high",
          sender_type:
            "existing_client|prospect|insurer|partner|provider|internal|other",
          matched_client_ref: "c0|null",
          actions: [
            {
              type: "attach_document",
              attachment_ref: "e0a0",
              document_category: "company_quote",
            },
            { type: "draft_reply", subject: "string", body: "string" },
            {
              type: "create_client",
              subject_is_sender: "boolean",
              first_name: "string",
              last_name: "string",
              company_name: "string",
              email: "string",
              phone: "string",
              address: "string",
              postal_code: "string",
              city: "string",
              date_of_birth: "AAAA-MM-JJ",
              birth_country: "string",
              insurance_type: "auto",
              needs: "string",
            },
            {
              type: "update_client",
              phone: "string",
              address: "string",
              postal_code: "string",
              city: "string",
              email: "string",
              date_of_birth: "AAAA-MM-JJ",
              birth_country: "string",
            },
            { type: "declare_claim", claim_type: "string", description: "string" },
            { type: "flag_renewal", note: "string" },
            { type: "add_note", note: "string" },
          ],
        },
      ],
    },
  });
}

/**
 * Normalise un nom de compagnie en jeton comparable à un domaine :
 * « Swiss Life » → « swisslife », « AXA France » → « axafrance ».
 */
function insurerToken(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * True when an address is an automated / bulk sender no human answers.
 *
 * Tri déterministe bon marché : ces emails forment le gros d'une boîte et
 * demander à un modèle d'énoncer l'évidence sur chacun coûte de l'argent.
 *
 * `insurerTokens` est le garde-fou décisif : une compagnie avec laquelle le
 * cabinet travaille n'est JAMAIS écartée, même depuis une adresse `noreply@`.
 * Le nom du domaine ne suffit pas — « axa.fr » ne contient aucun mot du secteur
 * — d'où les jetons tirés des assureurs partenaires et des contrats du
 * portefeuille.
 */
function isBulkSender(email: string, insurerTokens: Set<string>): boolean {
  const at = email.lastIndexOf("@");
  if (at <= 0) return false;

  const domain = email.slice(at + 1).toLowerCase();
  if (INSURANCE_DOMAIN_PATTERN.test(domain)) return false;

  const domainToken = insurerToken(domain);
  for (const token of insurerTokens) {
    if (domainToken.includes(token)) return false;
  }

  return BULK_SENDER_PATTERN.test(email.slice(0, at));
}

/**
 * Runs `fn` over `items` with a bounded number of in-flight promises. A mailbox
 * run touches hundreds of messages: firing every Graph or OpenAI call at once
 * gets the whole batch throttled.
 */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function classifyBatch(
  apiKey: string,
  userName: string,
  /** Rang du premier email du lot dans l'ensemble — voir buildUserPayload. */
  offset: number,
  messages: OutlookMessage[],
  attachmentsByMessage: Map<string, AttachmentRef[]>,
  clientRoster: RosterEntry[],
  mailboxByMessage: Map<string, string | null>,
  mailboxAddresses: string[],
  understoodByRef: Map<string, AttachmentUnderstanding>,
  bodyByMessage: Map<string, string>,
): Promise<AiResponse | null> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: DIGEST_MODEL,
      response_format: { type: "json_object" },
      // Large : ce plafond couvre AUSSI les jetons de raisonnement du modèle.
      // Trop bas, la réponse est coupée en plein JSON et tout le lot est perdu.
      max_completion_tokens: 16000,
      messages: [
        { role: "system", content: buildSystemPrompt(userName, mailboxAddresses) },
        {
          role: "user",
          content: buildUserPayload(
            offset,
            messages,
            attachmentsByMessage,
            clientRoster,
            mailboxByMessage,
            understoodByRef,
            bodyByMessage,
          ),
        },
      ],
    }),
  }).catch(() => null);

  // Diagnostic : un briefing qui échoue sans laisser de trace exploitable est
  // impossible à réparer. On dit POURQUOI, à chaque sortie possible.
  if (!res) {
    console.error("[digest] appel OpenAI injoignable (réseau)");
    return null;
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(
      `[digest] OpenAI a répondu ${res.status} : ${detail.slice(0, 300)}`,
    );
    return null;
  }

  const payload = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: {
      completion_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  } | null;

  const choice = payload?.choices?.[0];
  const content = choice?.message?.content;
  const usage = payload?.usage;
  const spent = `${usage?.completion_tokens ?? "?"} jetons dont ${
    usage?.completion_tokens_details?.reasoning_tokens ?? "?"
  } de raisonnement`;

  if (!content) {
    console.error(
      `[digest] réponse vide (finish_reason=${choice?.finish_reason ?? "?"}, ${spent})`,
    );
    return null;
  }

  try {
    return JSON.parse(content) as AiResponse;
  } catch {
    // Cause de loin la plus fréquente : réponse coupée au plafond de sortie,
    // le JSON s'arrête au milieu. Le finish_reason le dit.
    console.error(
      `[digest] JSON illisible (finish_reason=${choice?.finish_reason ?? "?"}, ${spent}, ${content.length} caractères) — fin: ${content.slice(-120)}`,
    );
    return null;
  }
}

/**
 * Classifies every message, in parallel batches.
 *
 * One request for the whole mailbox does not scale: a catch-up over several
 * weeks carries hundreds of emails whose bodies alone would exceed the context
 * window — and a single oversized call is both slower and more expensive than a
 * handful of small ones. Batches also degrade gracefully: if one fails, the rest
 * of the briefing still comes through.
 */
async function classifyEmails(
  apiKey: string,
  userName: string,
  messages: OutlookMessage[],
  attachmentsByMessage: Map<string, AttachmentRef[]>,
  clientRoster: RosterEntry[],
  mailboxByMessage: Map<string, string | null>,
  mailboxAddresses: string[],
  understoodByRef: Map<string, AttachmentUnderstanding>,
  bodyByMessage: Map<string, string>,
): Promise<AiResponse | null> {
  const batches: { offset: number; items: OutlookMessage[] }[] = [];
  for (let i = 0; i < messages.length; i += CLASSIFY_BATCH_SIZE) {
    batches.push({ offset: i, items: messages.slice(i, i + CLASSIFY_BATCH_SIZE) });
  }

  const results = await mapPool(batches, CLASSIFY_CONCURRENCY, (batch) =>
    classifyBatch(
      apiKey,
      userName,
      batch.offset,
      batch.items,
      attachmentsByMessage,
      clientRoster,
      mailboxByMessage,
      mailboxAddresses,
      understoodByRef,
      bodyByMessage,
    ),
  );

  const emails: AiEmailResult[] = [];
  const narratives: string[] = [];
  let failed = 0;
  for (const r of results) {
    if (!r) {
      failed += 1;
      continue;
    }
    if (r.emails) emails.push(...r.emails);
    const n = r.narrative?.trim();
    if (n) narratives.push(n);
  }

  // Everything failed → the caller must show an error, not an empty briefing.
  if (failed === results.length) return null;
  if (failed > 0) {
    console.error(`[digest] ${failed}/${results.length} classification batches failed`);
  }

  const narrative =
    narratives.length > 1
      ? ((await synthesizeNarrative(apiKey, userName, narratives)) ??
        narratives[0])
      : (narratives[0] ?? null);

  return { narrative: narrative ?? undefined, emails };
}

/**
 * Merges the per-batch narratives into the single paragraph the briefing shows.
 * Cheap call (a few hundred tokens) — on failure the caller falls back to the
 * first batch narrative rather than losing the briefing.
 */
async function synthesizeNarrative(
  apiKey: string,
  userName: string,
  narratives: string[],
): Promise<string | null> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: DIGEST_MODEL,
      max_completion_tokens: 400,
      messages: [
        {
          role: "system",
          content:
            `Tu rédiges le résumé d'ouverture du briefing email de ${userName}, courtier en assurance. ` +
            `On te donne plusieurs résumés partiels du même briefing : fusionne-les en 2 à 4 phrases, ` +
            `ton chaleureux et professionnel, en mettant l'urgent en avant. Pas de répétition, ` +
            `pas d'emojis, pas de jargon technique. Réponds uniquement par le texte.`,
        },
        { role: "user", content: narratives.join("\n\n") },
      ],
    }),
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const payload = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  return payload?.choices?.[0]?.message?.content?.trim() || null;
}

/**
 * Generates a fresh email briefing for the user: reads new Outlook messages
 * since the last digest, classifies them (strict brokerage relevance), and
 * persists the digest + relevant items + proposed actions. Nothing is executed
 * — the broker validates each suggestion afterwards.
 */
export async function generateDigest(
  ctx: DigestContext,
  options?: { windowDays?: number },
): Promise<GenerateDigestResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      reason: "ai_unconfigured",
      message: "L’assistant n’est pas encore activé (OPENAI_API_KEY manquant).",
    };
  }

  const mailbox = await getMailboxClient({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    profileId: ctx.profileId ?? null,
    adminSupabase: ctx.adminSupabase,
  });
  if (!mailbox) {
    return {
      success: false,
      reason: "not_connected",
      message: "Connectez votre boîte email pour générer le briefing.",
    };
  }

  try {
    return await runDigest(ctx, mailbox, options);
  } finally {
    // Une session IMAP reste ouverte tant qu'on ne la referme pas : ce `finally`
    // est ce qui empêche d'épuiser les connexions du serveur de messagerie.
    await mailbox.close();
  }
}

/** Corps du briefing, une fois la boîte ouverte. Voir `generateDigest`. */
async function runDigest(
  ctx: DigestContext,
  mailbox: MailboxClient,
  options?: { windowDays?: number },
): Promise<GenerateDigestResult> {
  const apiKey = process.env.OPENAI_API_KEY!;

  const now = new Date();
  const backfillDays =
    options?.windowDays && options.windowDays > 0
      ? Math.min(Math.floor(options.windowDays), BACKFILL_MAX_DAYS)
      : 0;
  const isBackfill = backfillDays > 0;

  let since: Date;
  if (isBackfill) {
    // Explicit "go back N days": scan the whole requested window. Already-
    // processed emails are still skipped below, so this only surfaces what was
    // missed (e.g. before the mailbox was connected, or emails set aside).
    since = new Date(now.getTime() - backfillDays * 86400_000);
  } else {
    // Rolling window: strictly since the last briefing — the broker launches it
    // himself, so a gap of several days (week-end, absence) must be caught up
    // in full rather than silently truncated to the last 24 h.
    // The FURTHEST point ever covered, not the most recent digest: a manual
    // "Remonter 90 jours" writes an older window and must never rewind the
    // rolling pointer to it.
    let pointerQuery = ctx.adminSupabase
      .from("broker_email_digests")
      .select("window_end")
      .eq("organization_id", ctx.organizationId)
      .eq("user_id", ctx.userId);
    // Chaque profil a sa boîte, donc son propre point de reprise.
    pointerQuery = ctx.profileId
      ? pointerQuery.eq("profile_id", ctx.profileId)
      : pointerQuery.is("profile_id", null);
    const { data: lastDigest } = await pointerQuery
      .order("window_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    const floor = new Date(now.getTime() - MAX_WINDOW_DAYS * 86400_000);
    since = new Date(now.getTime() - 86400_000);
    if (lastDigest?.window_end) {
      const prev = new Date(lastDigest.window_end);
      if (!Number.isNaN(prev.getTime())) since = prev;
    }
    if (since < floor) since = floor;
  }
  const sinceIso = since.toISOString();

  // A wide window (explicit backfill, or a briefing not run for a couple of
  // days) needs the higher email cap, otherwise the catch-up gets truncated.
  const windowSpanDays = (now.getTime() - since.getTime()) / 86400_000;
  const maxEmails =
    isBackfill || windowSpanDays > 1.5 ? BACKFILL_MAX_EMAILS : MAX_EMAILS;

  // Mailbox aliases (primary + SMTP proxies) so we can tag each email with the
  // address it was delivered to — the bespoke broker aggregates several.
  const mailboxAddresses = mailbox.addresses;
  const mailboxAddressSet = new Set(mailboxAddresses);

  const { messages: allMessages, truncated } = await mailbox.listInbox(
    sinceIso,
    maxEmails,
  );

  // Messages come back oldest first. When the cap cuts the window short, the
  // briefing must close on the last email it actually read — that timestamp is
  // where the next run picks up, so nothing in between is ever skipped.
  const lastRead = allMessages[allMessages.length - 1]?.receivedDateTime;
  const windowEnd =
    truncated && lastRead && !Number.isNaN(new Date(lastRead).getTime())
      ? new Date(lastRead).toISOString()
      : now.toISOString();
  if (truncated) {
    console.log(
      `[digest] window truncated at ${windowEnd} (${allMessages.length} emails read) — next run resumes there`,
    );
  }

  // Skip messages already processed in an earlier digest (idempotency).
  let candidates = allMessages;
  if (allMessages.length > 0) {
    const ids = allMessages.map((m) => m.id);
    let seenQuery = ctx.adminSupabase
      .from("broker_email_items")
      .select("graph_message_id")
      .eq("organization_id", ctx.organizationId)
      .eq("user_id", ctx.userId);
    // Sur un compte partagé l'utilisateur est le même pour tout le cabinet :
    // sans le profil, un email en copie à deux personnes disparaîtrait du
    // briefing de la seconde.
    seenQuery = ctx.profileId
      ? seenQuery.eq("profile_id", ctx.profileId)
      : seenQuery.is("profile_id", null);
    const { data: seen } = await seenQuery.in("graph_message_id", ids);
    const seenSet = new Set((seen ?? []).map((r) => r.graph_message_id));
    candidates = allMessages.filter((m) => !seenSet.has(m.id));
  }

  // Empty window → still record a digest so the UI shows "nothing new".
  if (candidates.length === 0) {
    const { data: digest } = await ctx.adminSupabase
      .from("broker_email_digests")
      .insert({
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        profile_id: ctx.profileId ?? null,
        status: "ready",
        narrative: isBackfill
          ? `Rien de non traité sur les ${backfillDays} derniers jours. Boîte à jour côté courtage.`
          : "Rien de nouveau depuis votre dernier briefing. Boîte à jour côté courtage.",
        window_start: sinceIso,
        window_end: windowEnd,
        relevant_count: 0,
        excluded_count: 0,
        generated_at: now.toISOString(),
      })
      .select("id")
      .single();
    return {
      success: true,
      digestId: digest?.id ?? "",
      relevant: 0,
      excluded: 0,
      uncertain: 0,
      truncated,
    };
  }

  // Client roster for matching (email + display name).
  const { data: clientRows } = await ctx.adminSupabase
    .from("broker_clients")
    .select("*")
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .limit(500);
  const clients = (clientRows ?? []) as BrokerClientRow[];
  const clientByEmail = new Map<string, BrokerClientRow>();
  const clientById = new Map<string, BrokerClientRow>();
  for (const c of clients) {
    clientById.set(c.id, c);
    if (c.email) clientByEmail.set(c.email.trim().toLowerCase(), c);
  }
  // Expose the whole portfolio to the AI with a stable short ref per dossier, so
  // it reasons over ALL clients (match by name/phone/content, not just email)
  // and returns the ref of the dossier an email concerns. We map the ref back
  // to a real client id ourselves — the AI never sees internal UUIDs.
  const refToClient = new Map<string, BrokerClientRow>();
  const clientRoster: RosterEntry[] = clients.slice(0, 200).map((c, i) => {
    const ref = `c${i}`;
    refToClient.set(ref, c);
    return {
      ref,
      name: brokerClientDisplayName(c),
      type: c.client_type === "company" ? "entreprise" : "particulier",
      email: c.email ?? null,
      phone: c.phone ?? null,
      address: c.address ?? null,
      postal_code: c.postal_code ?? null,
      city: c.city ?? null,
      branch: c.insurance_type ? insuranceTypeLabel(c.insurance_type) : null,
    };
  });

  // Resolve which mailbox address each message was delivered to — including the
  // ones set aside below, so an excluded email still shows its channel.
  const mailboxByMessage = new Map<string, string | null>();
  for (const m of candidates) {
    mailboxByMessage.set(m.id, resolveMailboxAddress(m, mailboxAddressSet));
  }

  // Deterministic pre-filter: automated / bulk senders never reach the model.
  // On a busy cabinet they are the majority of the inbox, and each one would
  // otherwise cost a body fetch, an attachment lookup and a slice of an OpenAI
  // request to be told what a regex already knows. Two safety valves, because a
  // missed insurer email costs far more than the tokens saved:
  //   - anything WITH an attachment is kept (insurers do send contracts and
  //     quotes from a noreply address);
  //   - anything from a domain that belongs to a client is kept.
  const clientDomains = new Set<string>();
  for (const c of clients) {
    const at = c.email?.lastIndexOf("@") ?? -1;
    if (c.email && at > 0) clientDomains.add(c.email.slice(at + 1).toLowerCase());
  }

  // Compagnies avec lesquelles le cabinet travaille : les grands assureurs
  // français, les partenaires déclarés, et ceux qui figurent sur un contrat ou
  // un devis du portefeuille. Aucun email venant d'eux n'est écarté sans avoir
  // été lu — « axa.fr » ne contient aucun mot du secteur, seul son nom le trahit.
  const insurerTokens = new Set<string>();
  const addInsurer = (name: string) => {
    // « Aviva / Abeille » désigne deux marques : chacune doit pouvoir matcher.
    for (const part of name.split(/[\/,]/)) {
      const token = insurerToken(part);
      if (token.length >= 3) insurerTokens.add(token);
    }
  };
  for (const name of commonInsurerSuggestions) addInsurer(name);

  const [{ data: org }, { data: contractInsurers }, { data: quoteInsurers }] =
    await Promise.all([
      ctx.adminSupabase
        .from("organizations")
        .select("broker_settings")
        .eq("id", ctx.organizationId)
        .maybeSingle(),
      ctx.adminSupabase
        .from("broker_contracts")
        .select("insurer_name")
        .eq("organization_id", ctx.organizationId)
        .not("insurer_name", "is", null)
        .limit(500),
      ctx.adminSupabase
        .from("broker_quotes")
        .select("insurer_name")
        .eq("organization_id", ctx.organizationId)
        .not("insurer_name", "is", null)
        .limit(500),
    ]);

  for (const name of parseBrokerSettings(org).partnerInsurers) addInsurer(name);
  for (const row of [...(contractInsurers ?? []), ...(quoteInsurers ?? [])]) {
    addInsurer((row as { insurer_name: string | null }).insurer_name ?? "");
  }
  const bulkMessages: OutlookMessage[] = [];
  const messages = candidates.filter((m) => {
    if (m.hasAttachments) return true;
    if (!isBulkSender(m.fromEmail, insurerTokens)) return true;
    const at = m.fromEmail.lastIndexOf("@");
    if (at > 0 && clientDomains.has(m.fromEmail.slice(at + 1))) return true;
    bulkMessages.push(m);
    return false;
  });
  if (bulkMessages.length > 0) {
    console.log(
      `[digest] ${bulkMessages.length}/${candidates.length} emails set aside as automated senders (no AI call)`,
    );
  }

  /** Records a pre-filtered email so the briefing's "écartés" stays exhaustive. */
  const insertBulkItems = async (digestId: string) => {
    if (bulkMessages.length === 0) return;
    await ctx.adminSupabase.from("broker_email_items").insert(
      bulkMessages.map((m) => ({
        organization_id: ctx.organizationId,
        digest_id: digestId,
        user_id: ctx.userId,
        profile_id: ctx.profileId ?? null,
        graph_message_id: m.id,
        from_name: m.fromName || null,
        from_email: m.fromEmail || null,
        subject: m.subject,
        received_at: m.receivedDateTime || null,
        web_link: m.webLink || null,
        mailbox_address: mailboxByMessage.get(m.id) ?? null,
        relevance: "excluded",
        exclusion_reason: "Expéditeur automatique (no-reply, envoi de masse).",
        has_attachments: m.hasAttachments,
      })),
    );
  };

  // Everything was automated mail: record the briefing without a single AI call.
  if (messages.length === 0) {
    const { data: digest } = await ctx.adminSupabase
      .from("broker_email_digests")
      .insert({
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        profile_id: ctx.profileId ?? null,
        status: "ready",
        narrative:
          "Rien à traiter côté courtage : seuls des emails automatiques sont arrivés.",
        window_start: sinceIso,
        window_end: windowEnd,
        relevant_count: 0,
        excluded_count: bulkMessages.length,
        generated_at: now.toISOString(),
      })
      .select("id")
      .single();
    if (digest) await insertBulkItems(digest.id);
    return {
      success: true,
      digestId: digest?.id ?? "",
      relevant: 0,
      excluded: bulkMessages.length,
      uncertain: 0,
      truncated,
    };
  }

  // Repères de durée : quand un briefing traîne ou échoue, il faut pouvoir dire
  // QUELLE étape a coûté le temps, sans instrumenter à chaud en production.
  const startedAt = Date.now();
  const phase = (label: string) =>
    console.log(`[digest] ${label} — ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  phase(`${messages.length} email(s) à analyser`);

  // Full email bodies — the AI must read what each email actually says, not a
  // ~250-char preview. Failures fall back to the preview (never blocking).
  const bodyByMessage = new Map<string, string>();
  await mapPool(messages, GRAPH_CONCURRENCY, async (m) => {
    const full = await mailbox.getBody(m.id);
    if (full?.body) bodyByMessage.set(m.id, full.body.slice(0, MAX_BODY_CHARS));
  });

  // Attachment metadata for messages that have attachments.
  const attachmentsByMessage = new Map<string, AttachmentRef[]>();
  const attachmentByRef = new Map<string, AttachmentRef>();
  await mapPool(messages, GRAPH_CONCURRENCY, async (m, i) => {
    // Fetch for EVERY message, not only those with hasAttachments=true: an
    // inline photo (e.g. sent from a phone / pasted in the body) does NOT set
    // that flag, yet is a real fileAttachment we must catch and classify.
    const metas = await mailbox.listAttachments(m.id);
    const refs = metas.map((meta, j) => {
      const ref: AttachmentRef = {
        ref: `e${i}a${j}`,
        messageId: m.id,
        attachmentId: meta.id,
        name: meta.name,
        contentType: meta.contentType,
        size: meta.size,
      };
      attachmentByRef.set(ref.ref, ref);
      return ref;
    });
    if (refs.length > 0) attachmentsByMessage.set(m.id, refs);
  });

  phase("corps et pièces jointes lus");

  // Read the content of document-like attachments (PDF/image) so classification
  // is based on what they ACTUALLY contain, not their file name — bounded in
  // count and size to keep the daily briefing cheap.
  const understoodByRef = new Map<string, AttachmentUnderstanding>();
  const analyzable = [...attachmentByRef.values()]
    .filter((a) => {
      if (!isReadableDocument(a.contentType, a.name)) return false;
      if (a.size <= 0 || a.size > MAX_ATTACHMENT_ANALYZE_BYTES) return false;
      // Skip tiny images (signature logos, tracking pixels) now that we fetch
      // attachments for every message.
      if (a.contentType.toLowerCase().startsWith("image/") && a.size < 15_000) {
        return false;
      }
      return true;
    })
    .slice(
      0,
      maxEmails > MAX_EMAILS
        ? BACKFILL_MAX_ATTACHMENTS_ANALYZED
        : MAX_ATTACHMENTS_ANALYZED,
    );
  await mapPool(analyzable, GRAPH_CONCURRENCY, async (a) => {
    const file = await mailbox.getAttachmentBytes(a.messageId, a.attachmentId);
    if (!file) return;
    const understood = await understandDocument({
      buffer: Buffer.from(file.contentBase64, "base64"),
      mimeType: a.contentType,
      fileName: a.name,
    });
    if (understood.ok) understoodByRef.set(a.ref, understood.data);
  });

  // Diagnostic: which attachments were fetched from Graph and how the content
  // read classified them (helps see if a PJ is missing vs mis-read).
  if (attachmentByRef.size > 0) {
    console.log(
      "[digest] attachments:",
      [...attachmentByRef.values()].map((a) => ({
        name: a.name,
        type: a.contentType,
        size: a.size,
        detected: understoodByRef.get(a.ref)?.category ?? "—",
      })),
    );
  } else {
    console.log(
      `[digest] no file attachments fetched (messages with hasAttachments=${
        messages.filter((m) => m.hasAttachments).length
      })`,
    );
  }

  phase("documents analysés (vision)");

  const ai = await classifyEmails(
    apiKey,
    ctx.userName,
    messages,
    attachmentsByMessage,
    clientRoster,
    mailboxByMessage,
    mailboxAddresses,
    understoodByRef,
    bodyByMessage,
  );

  phase("classification terminée");

  if (!ai) {
    return {
      success: false,
      reason: "ai_failed",
      message: "L’analyse de vos emails a échoué. Réessayez dans un instant.",
    };
  }

  const resultByRef = new Map<string, AiEmailResult>();
  for (const e of ai.emails ?? []) {
    if (e.ref) resultByRef.set(e.ref, e);
  }

  // Create the digest shell first so items can reference it.
  const { data: digest, error: digestError } = await ctx.adminSupabase
    .from("broker_email_digests")
    .insert({
      organization_id: ctx.organizationId,
      user_id: ctx.userId,
      profile_id: ctx.profileId ?? null,
      status: "ready",
      narrative: ai.narrative?.trim() || null,
      window_start: sinceIso,
      window_end: windowEnd,
      generated_at: now.toISOString(),
    })
    .select("id")
    .single();

  if (digestError || !digest) {
    return {
      success: false,
      reason: "persist_failed",
      message:
        "Enregistrement du briefing impossible. Vérifiez que la migration 0044 est appliquée.",
    };
  }

  // Pre-filtered emails belong to this briefing too: they are listed among the
  // "écartés" so the broker can always audit what the assistant set aside.
  await insertBulkItems(digest.id);

  let relevant = 0;
  let excluded = bulkMessages.length;
  let uncertain = 0;
  // Emails pour lesquels l'IA n'a rien renvoyé : signal d'un lot en échec ou
  // d'une réponse tronquée. Silencieux, ce serait invisible en production.
  let unanalysed = 0;

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    const r = resultByRef.get(`e${i}`);
    const relevance = r?.relevance;

    // Attachments read as real client documents (passport, RIB, devis, contrat).
    // A mail carrying one is relevant on its own: it must never be silently
    // excluded, and the document must always be offered for filing — even when
    // the body says nothing about it and the AI set the email aside.
    const msgAttachments = attachmentsByMessage.get(message.id) ?? [];
    const docAttachments = msgAttachments.filter((a) => {
      const u = understoodByRef.get(a.ref);
      return u ? CLIENT_DOC_CATEGORIES.has(u.category) : false;
    });
    const hasClientDoc = docAttachments.length > 0;
    // Every "real document" attachment on a kept email must be offered for
    // filing — even if the vision read failed or classified it as "other".
    // (Tiny images are skipped so email-signature logos don't create noise.)
    const offerableAttachments = msgAttachments.filter((a) => {
      const isImage = a.contentType.toLowerCase().startsWith("image/");
      const isOffice =
        /(msword|officedocument|ms-excel|spreadsheet)/i.test(a.contentType) ||
        /\.(docx?|xlsx?)$/i.test(a.name);
      if (isImage) return a.size >= 15_000;
      return isReadableDocument(a.contentType, a.name) || isOffice;
    });

    // Clairement hors sujet ET sans document client → écarté, avec le motif, si
    // bien que le courtier voit toujours ce qui a été mis de côté. Aucune action.
    //
    // Un email SANS verdict n'entre PAS ici : le silence de l'IA (lot en échec,
    // réponse tronquée, référence oubliée) n'est pas un rejet. Il passe en
    // « à vérifier » ci-dessous — perdre un virement de commission ou une
    // demande d'assureur parce qu'un lot a échoué est inacceptable.
    if (r && relevance === "no" && !hasClientDoc) {
      await ctx.adminSupabase.from("broker_email_items").insert({
        organization_id: ctx.organizationId,
        digest_id: digest.id,
        user_id: ctx.userId,
        profile_id: ctx.profileId ?? null,
        graph_message_id: message.id,
        from_name: message.fromName || null,
        from_email: message.fromEmail || null,
        subject: message.subject,
        received_at: message.receivedDateTime || null,
        web_link: message.webLink || null,
        mailbox_address: mailboxByMessage.get(message.id) ?? null,
        relevance: "excluded",
        exclusion_reason: r?.reason?.trim() || null,
        has_attachments: message.hasAttachments,
      });
      excluded += 1;
      continue;
    }

    // "yes" → relevant ; "uncertain", email non analysé, ou document client sur
    // un mail par ailleurs hors sujet → à vérifier (le courtier tranche).
    const itemRelevance = relevance === "yes" ? "relevant" : "uncertain";
    if (!r) unanalysed += 1;

    // Resolve which existing dossier this email belongs to. The AI reasoned over
    // the whole portfolio and returned the ref of the concerned dossier (or
    // null) — we trust that first, then fall back to legacy email hints. The
    // sender fallback only applies when the AI is NOT opening a new dossier, so
    // a mail from a known contact ABOUT a third party never binds to the sender.
    const wantsNewClient = (r?.actions ?? []).some(
      (a) => a.type === "create_client",
    );
    let clientId: string | null = null;
    const matchedRef =
      typeof r?.matched_client_ref === "string"
        ? r.matched_client_ref.trim()
        : "";
    if (matchedRef) {
      const matched = refToClient.get(matchedRef);
      if (matched) clientId = matched.id;
    }
    if (!clientId && r?.client_match_email) {
      const m = clientByEmail.get(r.client_match_email.trim().toLowerCase());
      if (m) clientId = m.id;
    }
    if (!clientId && !wantsNewClient) {
      const senderMatch = clientByEmail.get(message.fromEmail);
      if (senderMatch) clientId = senderMatch.id;
    }

    // Category & summary: the AI's when present, else derived from the document
    // that made this mail relevant (so a bare passport still reads clearly).
    const docCategory = docAttachments.some(
      (a) => understoodByRef.get(a.ref)?.category === "company_quote",
    )
      ? "quote"
      : docAttachments.some(
            (a) => understoodByRef.get(a.ref)?.category === "contract",
          )
        ? "contract"
        : "client_request";
    const category =
      r?.category && isEmailCategory(r.category)
        ? r.category
        : hasClientDoc
          ? docCategory
          : "other_broker";
    const docSummary = hasClientDoc
      ? `Pièce jointe reçue : ${docAttachments
          .map((a) => understoodByRef.get(a.ref)?.label || a.name)
          .join(", ")}.`
      : null;

    const { data: item } = await ctx.adminSupabase
      .from("broker_email_items")
      .insert({
        organization_id: ctx.organizationId,
        digest_id: digest.id,
        user_id: ctx.userId,
        profile_id: ctx.profileId ?? null,
        graph_message_id: message.id,
        from_name: message.fromName || null,
        from_email: message.fromEmail || null,
        subject: message.subject,
        received_at: message.receivedDateTime || null,
        web_link: message.webLink || null,
        mailbox_address: mailboxByMessage.get(message.id) ?? null,
        category,
        summary: r?.summary?.trim() || docSummary,
        urgency: r?.urgency === "high" ? "high" : "normal",
        relevance: itemRelevance,
        exclusion_reason:
          itemRelevance === "uncertain"
            ? r?.reason?.trim() ||
              (hasClientDoc
                ? "Pièce jointe à classer dans un dossier."
                : !r
                  ? "Non analysé automatiquement — à vérifier."
                  : null)
            : null,
        suggested_client_id: clientId,
        has_attachments: message.hasAttachments,
      })
      .select("id")
      .single();

    if (!item) continue;
    if (itemRelevance === "uncertain") uncertain += 1;
    else relevant += 1;

    // Build the suggestion rows from the AI actions.
    const suggestionRows: Database["public"]["Tables"]["broker_email_suggestions"]["Insert"][] =
      [];
    // Track attachments already filed so the safety-net backfill below doesn't
    // duplicate them.
    const handledAttachmentRefs = new Set<string>();
    for (const action of r?.actions ?? []) {
      if (action.type === "attach_document") {
        const att = action.attachment_ref
          ? attachmentByRef.get(action.attachment_ref)
          : undefined;
        if (!att) continue;
        handledAttachmentRefs.add(att.ref);
        // Prefer the category read from the content over the AI's/file-name guess.
        const understood = understoodByRef.get(att.ref);
        const documentCategory =
          understood?.category ??
          normalizeAttachmentCategory(action.document_category);
        suggestionRows.push({
          organization_id: ctx.organizationId,
          item_id: item.id,
          user_id: ctx.userId,
          type: "attach_document",
          payload: {
            graph_message_id: att.messageId,
            graph_attachment_id: att.attachmentId,
            file_name: att.name,
            content_type: att.contentType,
            size: att.size,
            document_category: documentCategory,
            client_id: clientId,
            // Who the document is about, read from its content. Lets the
            // briefing pre-select the dossier even when the SENDER didn't
            // match any client (insurer forwarding a client's quote).
            detected_subject_name: understood?.subject_name ?? null,
            detected_label: understood?.label ?? null,
          },
        });
      } else if (action.type === "draft_reply") {
        if (!action.body?.trim()) continue;
        suggestionRows.push({
          organization_id: ctx.organizationId,
          item_id: item.id,
          user_id: ctx.userId,
          type: "draft_reply",
          payload: {
            to: message.fromEmail,
            subject:
              action.subject?.trim() || `RE: ${message.subject}`.slice(0, 240),
            body: action.body.trim(),
          },
        });
      } else if (action.type === "create_client") {
        // Only meaningful when no existing client matched.
        if (clientId) continue;
        const insuranceType =
          action.insurance_type &&
          (brokerInsuranceTypes as readonly string[]).includes(
            action.insurance_type,
          )
            ? action.insurance_type
            : null;
        // The dossier is the INSURED client's, not the sender's. Only borrow the
        // sender's email when the sender is confirmed to be that client — so an
        // email written by an intermediary about a third party never files the
        // sender's address (or name) onto the new dossier.
        const senderIsClient = action.subject_is_sender !== false;
        const clientEmail =
          action.email?.trim() || (senderIsClient ? message.fromEmail : null) || null;
        // Need at least a name/company (or, for the sender themselves, an email)
        // to open a meaningful dossier — otherwise skip rather than create a blank.
        const hasIdentity =
          Boolean(action.first_name?.trim()) ||
          Boolean(action.last_name?.trim()) ||
          Boolean(action.company_name?.trim()) ||
          (senderIsClient && Boolean(clientEmail));
        if (!hasIdentity) continue;
        suggestionRows.push({
          organization_id: ctx.organizationId,
          item_id: item.id,
          user_id: ctx.userId,
          type: "create_client",
          payload: {
            first_name: action.first_name?.trim() || null,
            last_name: action.last_name?.trim() || null,
            company_name: action.company_name?.trim() || null,
            email: clientEmail,
            // Identity fields land in their own dossier columns — a phone
            // number buried in a free-text note is not a CRM.
            phone: action.phone?.trim() || null,
            address: action.address?.trim() || null,
            postal_code: action.postal_code?.trim() || null,
            city: action.city?.trim() || null,
            date_of_birth: normalizeBirthDate(action.date_of_birth),
            birth_country: action.birth_country?.trim() || null,
            insurance_type: insuranceType,
            // Only what the dossier has no field for: the need itself.
            notes: action.needs?.trim() || null,
          },
        });
      } else if (action.type === "update_client") {
        // Only meaningful for a returning (matched) client.
        if (!clientId) continue;
        // Keep only fields that are actually new/different from the stored
        // dossier — so we never surface a no-op "update" to the broker.
        const current = clientById.get(clientId);
        const changed = (value: string | undefined, existing: string | null) => {
          const v = value?.trim();
          if (!v) return null;
          return (existing ?? "").trim().toLowerCase() === v.toLowerCase()
            ? null
            : v;
        };
        const fields: Record<string, string> = {};
        const phone = changed(action.phone, current?.phone ?? null);
        if (phone) fields.phone = phone;
        const address = changed(action.address, current?.address ?? null);
        if (address) fields.address = address;
        const postalCode = changed(
          action.postal_code,
          current?.postal_code ?? null,
        );
        if (postalCode) fields.postal_code = postalCode;
        const city = changed(action.city, current?.city ?? null);
        if (city) fields.city = city;
        const email = changed(action.email, current?.email ?? null);
        if (email) fields.email = email;
        const birthDate = changed(
          normalizeBirthDate(action.date_of_birth) ?? undefined,
          current?.date_of_birth ?? null,
        );
        if (birthDate) fields.date_of_birth = birthDate;
        const birthCountry = changed(
          action.birth_country,
          current?.birth_country ?? null,
        );
        if (birthCountry) fields.birth_country = birthCountry;
        if (Object.keys(fields).length === 0) continue;
        suggestionRows.push({
          organization_id: ctx.organizationId,
          item_id: item.id,
          user_id: ctx.userId,
          type: "update_client",
          payload: { client_id: clientId, ...fields },
        });
      } else if (action.type === "add_note") {
        // Record important email info into the existing dossier's notes.
        if (!clientId) continue;
        const note = action.note?.trim();
        if (!note) continue;
        suggestionRows.push({
          organization_id: ctx.organizationId,
          item_id: item.id,
          user_id: ctx.userId,
          type: "add_note",
          payload: { client_id: clientId, note },
        });
      } else if (action.type === "declare_claim") {
        suggestionRows.push({
          organization_id: ctx.organizationId,
          item_id: item.id,
          user_id: ctx.userId,
          type: "declare_claim",
          payload: {
            client_id: clientId,
            claim_type: action.claim_type?.trim() || null,
            description: action.description?.trim() || null,
          },
        });
      } else if (action.type === "flag_renewal") {
        suggestionRows.push({
          organization_id: ctx.organizationId,
          item_id: item.id,
          user_id: ctx.userId,
          type: "flag_renewal",
          payload: {
            client_id: clientId,
            note: action.note?.trim() || null,
          },
        });
      }
    }

    // Safety net: EVERY document-like attachment on this kept email gets an
    // attach_document suggestion, even if the AI didn't emit one and even if the
    // vision read failed (e.g. a bare passport with no message body). The broker
    // picks the dossier if none was matched. Guarantees no document is dropped.
    for (const att of offerableAttachments) {
      if (handledAttachmentRefs.has(att.ref)) continue;
      handledAttachmentRefs.add(att.ref);
      const understood = understoodByRef.get(att.ref);
      suggestionRows.push({
        organization_id: ctx.organizationId,
        item_id: item.id,
        user_id: ctx.userId,
        type: "attach_document",
        payload: {
          graph_message_id: att.messageId,
          graph_attachment_id: att.attachmentId,
          file_name: att.name,
          content_type: att.contentType,
          size: att.size,
          document_category:
            understood?.category ?? normalizeAttachmentCategory(null),
          client_id: clientId,
          detected_subject_name: understood?.subject_name ?? null,
          detected_label: understood?.label ?? null,
        },
      });
    }

    if (suggestionRows.length > 0) {
      const { error: insertError } = await ctx.adminSupabase
        .from("broker_email_suggestions")
        .insert(suggestionRows);
      if (insertError) {
        // A single rejected row (e.g. a suggestion type not yet allowed by the
        // DB CHECK constraint before its migration is applied) must NOT drop the
        // other suggestions. Retry row by row so the valid ones still land, and
        // log which type failed so the cause is visible.
        console.error(
          "[digest] batch suggestion insert failed, retrying individually:",
          insertError.message,
        );
        for (const row of suggestionRows) {
          const { error: rowError } = await ctx.adminSupabase
            .from("broker_email_suggestions")
            .insert(row);
          if (rowError) {
            console.error(
              `[digest] suggestion insert failed (type=${row.type}):`,
              rowError.message,
            );
          }
        }
      }
    }
  }

  if (unanalysed > 0) {
    console.error(
      `[digest] ${unanalysed}/${messages.length} email(s) sans verdict de l'IA — passés en « à vérifier » plutôt qu'écartés`,
    );
  }

  await ctx.adminSupabase
    .from("broker_email_digests")
    .update({
      relevant_count: relevant,
      excluded_count: excluded,
      updated_at: new Date().toISOString(),
    })
    .eq("id", digest.id);

  return {
    success: true,
    digestId: digest.id,
    relevant,
    excluded,
    uncertain,
    truncated,
  };
}
