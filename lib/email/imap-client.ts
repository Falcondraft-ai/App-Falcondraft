import "server-only";

import { ImapFlow, type FetchMessageObject } from "imapflow";
import nodemailer from "nodemailer";
import type {
  MailAttachmentMeta,
  MailDraft,
  MailDraftResult,
  MailMessage,
  MailMessageBody,
  MailSearchCriteria,
  MailboxClient,
  MailboxPage,
} from "@/lib/email/mailbox";

/**
 * Boîte email accédée en IMAP/SMTP.
 *
 * Une session IMAP est une connexion TCP vivante, pas une suite de requêtes HTTP
 * sans état : elle s'ouvre, se verrouille sur un dossier, et DOIT se refermer.
 * D'où `close()` obligatoire côté appelant, et un cache par instance
 * (identifiant → UID + structure du message) qui évite de re-parcourir la boîte
 * à chaque lecture de corps ou de pièce jointe pendant un même briefing.
 */

/** Garde-fou réseau : une boîte injoignable ne doit pas figer une requête. */
const CONNECT_TIMEOUT_MS = 20_000;
const GREETING_TIMEOUT_MS = 15_000;
const SOCKET_TIMEOUT_MS = 60_000;

/** Au-delà, on tronque : voir `truncated`, la reprise se fait au run suivant. */
const HARD_MAX = 1000;

export type ImapConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  /** Mot de passe EN CLAIR — déchiffré juste avant l'appel, jamais journalisé. */
  password: string;
  address: string;
  smtp?: { host: string; port: number; secure: boolean } | null;
};

type CachedMessage = {
  /** Dossier IMAP du message : un UID n'a de sens que dans son dossier. */
  mailbox: string;
  uid: number;
  /** Structure MIME, conservée pour cibler le corps et les pièces jointes
   *  sans retélécharger le message entier. */
  parts: MimePart[];
  /** Partie texte brut, si l'email en propose une. */
  textPart: string | null;
  /** Partie HTML, si l'email en propose une : c'est elle qu'on affiche. */
  htmlPart: string | null;
};

type MimePart = {
  part: string;
  type: string;
  encoding?: string;
  size?: number;
  disposition?: string | null;
  filename?: string | null;
};

/* -------------------------------------------------------------------------- */
/*  Structure MIME                                                            */
/* -------------------------------------------------------------------------- */

type RawBodyStructure = {
  part?: string;
  type?: string;
  encoding?: string;
  size?: number;
  disposition?: string;
  dispositionParameters?: Record<string, string>;
  parameters?: Record<string, string>;
  childNodes?: RawBodyStructure[];
};

/** Aplatit l'arbre MIME en une liste de feuilles exploitables. */
function flattenParts(node: RawBodyStructure | undefined, acc: MimePart[] = []): MimePart[] {
  if (!node) return acc;
  if (node.childNodes?.length) {
    for (const child of node.childNodes) flattenParts(child, acc);
    return acc;
  }
  acc.push({
    part: node.part || "1",
    type: (node.type || "").toLowerCase(),
    encoding: node.encoding,
    size: node.size,
    disposition: node.disposition?.toLowerCase() ?? null,
    filename:
      node.dispositionParameters?.filename ?? node.parameters?.name ?? null,
  });
  return acc;
}

/**
 * Une pièce jointe au sens du courtier : un fichier, pas un décor.
 *
 * On écarte le texte du message et les images inline sans nom de fichier
 * (signatures, pixels de suivi), qui sinon polluent chaque dossier client.
 */
function isRealAttachment(part: MimePart): boolean {
  if (part.disposition === "attachment") return true;
  if (part.type.startsWith("text/") && !part.filename) return false;
  return Boolean(part.filename);
}

function pickPart(parts: MimePart[], type: string): string | null {
  return parts.find((p) => p.type === type && !p.filename)?.part ?? null;
}

/** HTML → texte lisible, même conversion que côté Microsoft. */
function htmlToText(raw: string): string {
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Les dates IMAP arrivent en Date ou en chaîne selon le serveur. */
function toIso(value: string | Date | undefined | null): string {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

function addressList(
  entries: { name?: string; address?: string }[] | undefined,
): string[] {
  return (entries ?? [])
    .map((e) => e.address?.trim().toLowerCase())
    .filter((a): a is string => Boolean(a));
}

/* -------------------------------------------------------------------------- */
/*  Client                                                                    */
/* -------------------------------------------------------------------------- */

export class ImapMailboxClient implements MailboxClient {
  readonly provider = "imap" as const;
  readonly address: string;
  readonly addresses: string[];

  private client: ImapFlow | null = null;
  private lock: { release: () => void } | null = null;
  /** Dossier actuellement sélectionné (et verrouillé) sur la session. */
  private currentPath: string | null = null;
  /** Dossier des envoyés : undefined = pas encore cherché, null = aucun. */
  private sentPath: string | null | undefined = undefined;
  private readonly config: ImapConfig;
  private readonly cache = new Map<string, CachedMessage>();

  constructor(config: ImapConfig) {
    this.config = config;
    this.address = config.address.trim().toLowerCase();
    // IMAP n'expose aucune notion d'alias : la seule adresse connue est celle
    // qui a été configurée. Un cabinet qui regroupe plusieurs adresses dans une
    // boîte les déclare en créant un profil par adresse.
    this.addresses = [this.address];
  }

  /** Ouvre la session (idempotent) et verrouille la boîte de réception. */
  private async connect(): Promise<ImapFlow> {
    if (this.client) return this.client;

    const client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: { user: this.config.user, pass: this.config.password },
      // Le logger d'ImapFlow recrache les commandes, donc potentiellement des
      // en-têtes et des identifiants : coupé net.
      logger: false,
      connectionTimeout: CONNECT_TIMEOUT_MS,
      greetingTimeout: GREETING_TIMEOUT_MS,
      socketTimeout: SOCKET_TIMEOUT_MS,
    });

    await client.connect();
    this.lock = await client.getMailboxLock("INBOX");
    this.currentPath = "INBOX";
    this.client = client;
    return client;
  }

  /**
   * Sélectionne un dossier. IMAP travaille sur UN dossier à la fois : pour lire
   * les envoyés, on relâche la réception, on verrouille l'autre dossier, et
   * l'appel suivant qui a besoin de la réception la reprend.
   */
  private async open(path: string): Promise<ImapFlow> {
    const client = await this.connect();
    if (this.currentPath === path) return client;
    this.lock?.release();
    this.lock = null;
    // Nul pendant l'acquisition : si le dossier n'existe pas, le prochain
    // open() reprend proprement au lieu de croire la session encore sélectionnée.
    this.currentPath = null;
    this.lock = await client.getMailboxLock(path);
    this.currentPath = path;
    return client;
  }

  /**
   * Retrouve le dossier des envoyés. Même problème que la corbeille : son nom
   * change selon l'hébergeur et la langue ; SPECIAL-USE d'abord, les noms
   * courants ensuite, jamais une supposition.
   */
  private async findSentPath(): Promise<string | null> {
    if (this.sentPath !== undefined) return this.sentPath;
    const client = await this.connect();
    try {
      const boxes = await client.list();
      const special = boxes.find((b) => b.specialUse === "\\Sent");
      const known =
        special ??
        boxes.find((b) =>
          /^(inbox[./])?(sent|sent items|sent messages|sent mail|envoy[ée]s|messages envoy[ée]s|[ée]l[ée]ments envoy[ée]s|enviados)$/i.test(
            b.path,
          ),
        );
      this.sentPath = known?.path ?? null;
    } catch (error) {
      console.error("[imap] liste des dossiers impossible:", error);
      this.sentPath = null;
    }
    return this.sentPath;
  }

  async close(): Promise<void> {
    try {
      this.lock?.release();
    } catch {
      // Un verrou déjà relâché ne doit pas masquer le résultat de l'appelant.
    }
    this.lock = null;
    try {
      await this.client?.logout();
    } catch {
      // Idem : la déconnexion est du nettoyage, jamais une cause d'échec.
    }
    this.client = null;
  }

  private toMessage(
    msg: FetchMessageObject,
    mailbox = "INBOX",
  ): MailMessage | null {
    const envelope = msg.envelope;
    if (!envelope) return null;

    const parts = flattenParts(msg.bodyStructure as RawBodyStructure | undefined);
    const from = envelope.from?.[0];
    // Message-ID plutôt que l'UID : il est stable même si le serveur renumérote
    // (changement d'UIDVALIDITY), ce qui évite de re-présenter toute la boîte
    // comme du courrier neuf.
    const id = envelope.messageId?.trim() || `imap:${msg.uid}`;

    this.cache.set(id, {
      mailbox,
      uid: msg.uid,
      parts,
      textPart: pickPart(parts, "text/plain"),
      htmlPart: pickPart(parts, "text/html"),
    });

    return {
      id,
      subject: envelope.subject?.trim() || "(sans objet)",
      fromName: from?.name?.trim() || "",
      fromEmail: from?.address?.trim().toLowerCase() || "",
      receivedDateTime: toIso(envelope.date ?? msg.internalDate),
      bodyPreview: "",
      hasAttachments: parts.some(isRealAttachment),
      // IMAP n'a pas d'URL de message : le courtier ouvre l'email dans son
      // propre logiciel. L'interface masque le lien quand il est vide.
      webLink: "",
      conversationId: envelope.inReplyTo?.trim() || "",
      recipients: [
        ...addressList(envelope.to),
        ...addressList(envelope.cc),
      ],
    };
  }

  listInbox(
    sinceIso: string,
    max: number,
    options?: { order?: "asc" | "desc" },
  ): Promise<MailboxPage> {
    return this.listFolder("INBOX", sinceIso, max, options);
  }

  /** Messages envoyés depuis `sinceIso`, du plus ancien au plus récent. */
  async listSent(
    sinceIso: string,
    max: number,
    options?: { order?: "asc" | "desc" },
  ): Promise<MailboxPage> {
    const path = await this.findSentPath();
    if (!path) return { messages: [], truncated: false };
    try {
      return await this.listFolder(path, sinceIso, max, options);
    } catch (error) {
      console.error("[imap] lecture des envoyés impossible:", error);
      return { messages: [], truncated: false };
    }
  }

  private async listFolder(
    path: string,
    sinceIso: string,
    max: number,
    options?: { order?: "asc" | "desc" },
  ): Promise<MailboxPage> {
    const client = await this.open(path);
    const limit = Math.min(Math.max(max, 1), HARD_MAX);
    const since = new Date(sinceIso);

    const collected: MailMessage[] = [];
    try {
      // IMAP SEARCH est à la journée près : on redemande la veille et on affine
      // ensuite sur l'horodatage réel, sinon on perdrait les emails du jour de
      // reprise.
      const searchSince = new Date(since.getTime() - 86_400_000);

      // Lecture d'une BOÎTE (ordre décroissant) : on ne veut que les `limit`
      // messages les plus récents. Tout parcourir pour n'en garder que la fin
      // faisait payer une fenêtre de deux semaines entière — des milliers
      // d'enveloppes et de structures MIME — pour en afficher deux cents.
      //
      // SEARCH ne rapporte que des UID (une seule commande, quelques kilo-octets) :
      // on prend la queue de la liste, la plus récente puisque les UID croissent
      // avec l'arrivée, et on ne demande le détail que de ceux-là.
      if (options?.order === "desc") {
        const uids = await client.search({ since: searchSince }, { uid: true });
        const all = Array.isArray(uids) ? uids : [];
        if (all.length === 0) return { messages: [], truncated: false };
        // Une marge au-delà du plafond : l'affinage à l'horodatage réel, plus
        // bas, peut écarter quelques messages de la journée de reprise.
        const wanted = all.slice(-(limit + 20));

        for await (const msg of client.fetch(
          wanted,
          { uid: true, envelope: true, bodyStructure: true, internalDate: true },
          { uid: true },
        )) {
          const mapped = this.toMessage(msg, path);
          if (!mapped) continue;
          if (new Date(mapped.receivedDateTime).getTime() < since.getTime()) {
            continue;
          }
          collected.push(mapped);
        }

        collected.sort((a, b) =>
          b.receivedDateTime.localeCompare(a.receivedDateTime),
        );
        return {
          messages: collected.slice(0, limit),
          truncated: all.length > wanted.length,
        };
      }

      for await (const msg of client.fetch(
        { since: searchSince },
        { uid: true, envelope: true, bodyStructure: true, internalDate: true },
        { uid: true },
      )) {
        const mapped = this.toMessage(msg, path);
        if (!mapped) continue;
        if (new Date(mapped.receivedDateTime).getTime() < since.getTime()) continue;
        collected.push(mapped);
        // Le serveur renvoie par ordre d'arrivée croissant : dès qu'on a de quoi
        // remplir la fenêtre (plus un, pour savoir s'il en reste), on arrête. Un
        // rattrapage de trois semaines représente des milliers de messages qu'il
        // serait absurde de charger pour n'en garder que quelques centaines.
        if (collected.length > limit) break;
      }
    } catch (error) {
      console.error("[imap] list failed:", error);
      return { messages: collected, truncated: collected.length > 0 };
    }

    collected.sort((a, b) =>
      a.receivedDateTime.localeCompare(b.receivedDateTime),
    );

    // Ordre chronologique : on garde le DÉBUT de la fenêtre, jamais vu, et on
    // signale la troncature pour que le run suivant reprenne à la suite.
    return {
      messages: collected.slice(0, limit),
      truncated: collected.length > limit,
    };
  }

  /** Retrouve un message mis en cache, ou le recherche par son Message-ID. */
  private async resolve(messageId: string): Promise<CachedMessage | null> {
    const cached = this.cache.get(messageId);
    if (cached) return cached;

    // Réception d'abord, envoyés ensuite : un email ouvert depuis un dossier
    // client peut être une réponse du cabinet.
    const sent = await this.findSentPath();
    for (const path of sent ? ["INBOX", sent] : ["INBOX"]) {
      try {
        const client = await this.open(path);
        const uids = await client.search(
          { header: { "message-id": messageId } },
          { uid: true },
        );
        const uid = Array.isArray(uids) ? uids[uids.length - 1] : undefined;
        if (!uid) continue;

        const msg = await client.fetchOne(
          String(uid),
          { uid: true, envelope: true, bodyStructure: true, internalDate: true },
          { uid: true },
        );
        if (!msg) continue;
        this.toMessage(msg, path);
        const entry = this.cache.get(messageId);
        if (entry) return entry;
      } catch (error) {
        console.error("[imap] resolve failed:", error);
      }
    }
    return null;
  }

  private async downloadPart(
    entry: CachedMessage,
    part: string,
  ): Promise<Buffer | null> {
    try {
      const client = await this.open(entry.mailbox);
      const { content } = await client.download(String(entry.uid), part, {
        uid: true,
      });
      const chunks: Buffer[] = [];
      for await (const chunk of content) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
      }
      return Buffer.concat(chunks);
    } catch (error) {
      console.error("[imap] download failed:", error);
      return null;
    }
  }

  async getBody(messageId: string): Promise<MailMessageBody | null> {
    const entry = await this.resolve(messageId);
    if (!entry) return null;

    // Les deux versions quand elles existent : le HTML pour l'affichage, le
    // texte pour l'analyse. Un email n'a pas toujours les deux — on dérive
    // alors l'un de l'autre plutôt que de rendre un message vide.
    const [htmlRaw, textRaw] = await Promise.all([
      entry.htmlPart ? this.downloadPart(entry, entry.htmlPart) : null,
      entry.textPart ? this.downloadPart(entry, entry.textPart) : null,
    ]);

    const html = htmlRaw?.toString("utf8") ?? null;
    const text = textRaw?.toString("utf8").trim() ?? (html ? htmlToText(html) : "");
    if (!html && !text) return null;

    return {
      subject: "",
      fromName: "",
      fromEmail: "",
      receivedDateTime: "",
      body: text.slice(0, 6000),
      // Non assaini : l'appelant le fait passer par sanitizeEmailHtml avant
      // tout rendu. Voir lib/email/html.ts.
      html,
    };
  }

  async listAttachments(messageId: string): Promise<MailAttachmentMeta[]> {
    const entry = await this.resolve(messageId);
    if (!entry) return [];

    return entry.parts.filter(isRealAttachment).map((p) => ({
      // L'identifiant d'une pièce jointe IMAP est son chemin MIME dans le
      // message ("2", "1.3"…) — stable tant que le message existe.
      id: p.part,
      name: p.filename || `piece-jointe-${p.part}`,
      contentType: p.type || "application/octet-stream",
      // Taille encodée : le base64 gonfle d'environ un tiers. On revient à la
      // taille réelle pour que les plafonds de lecture restent justes.
      size: p.encoding?.toLowerCase() === "base64"
        ? Math.round((p.size ?? 0) * 0.75)
        : (p.size ?? 0),
    }));
  }

  async getAttachmentBytes(
    messageId: string,
    attachmentId: string,
  ): Promise<{ name: string; contentType: string; contentBase64: string } | null> {
    const entry = await this.resolve(messageId);
    if (!entry) return null;
    const part = entry.parts.find((p) => p.part === attachmentId);
    if (!part) return null;

    const buffer = await this.downloadPart(entry, attachmentId);
    if (!buffer) return null;

    return {
      name: part.filename || `piece-jointe-${part.part}`,
      contentType: part.type || "application/octet-stream",
      contentBase64: buffer.toString("base64"),
    };
  }

  /**
   * Retrouve la corbeille de la boîte.
   *
   * IMAP ne normalise pas son nom : « Trash », « Corbeille », « Deleted
   * Messages », « INBOX.Trash » selon l'hébergeur et la langue. L'attribut
   * SPECIAL-USE (RFC 6154) donne la réponse quand le serveur le publie ; à
   * défaut on retombe sur les noms courants, jamais sur une supposition.
   */
  private async findTrashPath(client: ImapFlow): Promise<string | null> {
    try {
      const boxes = await client.list();
      const special = boxes.find((b) => b.specialUse === "\\Trash");
      if (special) return special.path;

      const known = boxes.find((b) =>
        /^(inbox[./])?(trash|corbeille|deleted items|deleted messages|elementos eliminados|papelera)$/i.test(
          b.path,
        ),
      );
      return known?.path ?? null;
    } catch (error) {
      console.error("[imap] liste des dossiers impossible:", error);
      return null;
    }
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    const entry = await this.resolve(messageId);
    if (!entry) return false;

    try {
      const client = await this.open(entry.mailbox);
      const trash = await this.findTrashPath(client);
      if (trash) {
        await client.messageMove(String(entry.uid), trash, { uid: true });
      } else {
        // Aucune corbeille : le serveur n'en propose pas (certains IMAP
        // minimalistes). On marque \Deleted et on purge — c'est le seul
        // comportement possible, et l'interface prévient que la suppression
        // est alors définitive.
        await client.messageDelete(String(entry.uid), { uid: true });
      }
      // Le cache pointerait un UID qui n'existe plus dans son dossier.
      this.cache.delete(messageId);
      return true;
    } catch (error) {
      console.error("[imap] suppression impossible:", error);
      return false;
    }
  }

  /** La boîte propose-t-elle une corbeille ? Sinon, supprimer est définitif. */
  async hasTrashFolder(): Promise<boolean> {
    try {
      const client = await this.connect();
      return (await this.findTrashPath(client)) !== null;
    } catch {
      return false;
    }
  }

  async searchForClient(
    criteria: MailSearchCriteria,
    query?: string,
    max = 30,
  ): Promise<MailMessage[]> {
    // Une recherche IMAP par critère, fusionnée ensuite : le protocole ne sait
    // pas exprimer un OU sur des champs différents de façon fiable d'un serveur
    // à l'autre, et enchaîner des recherches simples est plus robuste.
    const searches: Record<string, unknown>[] = [];
    for (const email of criteria.emails) {
      searches.push({ or: [{ from: email }, { to: email }, { cc: email }] });
    }
    if (criteria.domain) {
      searches.push({
        or: [
          { from: criteria.domain },
          { to: criteria.domain },
          { cc: criteria.domain },
        ],
      });
    }
    for (const name of criteria.names) {
      if (name.trim().length >= 3) searches.push({ body: name.trim() });
    }
    for (const ref of criteria.references) {
      if (ref.trim().length >= 4) searches.push({ body: ref.trim() });
    }
    if (searches.length === 0) return [];

    // Réception ET envoyés : un dossier client montre la conversation entière,
    // ce que l'assuré a écrit comme ce que le cabinet lui a répondu.
    const sent = await this.findSentPath();
    const byId = new Map<string, MailMessage>();
    for (const path of sent ? ["INBOX", sent] : ["INBOX"]) {
      const found = await this.searchFolder(path, searches, query, max).catch(
        (error: unknown) => {
          console.error("[imap] search failed:", error);
          return [] as MailMessage[];
        },
      );
      for (const m of found) if (!byId.has(m.id)) byId.set(m.id, m);
    }

    return [...byId.values()]
      .sort((a, b) => b.receivedDateTime.localeCompare(a.receivedDateTime))
      .slice(0, max);
  }

  private async searchFolder(
    path: string,
    searches: Record<string, unknown>[],
    query: string | undefined,
    max: number,
  ): Promise<MailMessage[]> {
    const client = await this.open(path);
    const uids = new Set<number>();
    for (const criterion of searches.slice(0, 8)) {
      try {
        const found = await client.search(
          query?.trim()
            ? { ...criterion, body: query.trim() }
            : (criterion as Parameters<typeof client.search>[0]),
          { uid: true },
        );
        if (Array.isArray(found)) for (const uid of found) uids.add(uid);
      } catch (error) {
        console.error("[imap] search failed:", error);
      }
      if (uids.size >= max * 3) break;
    }
    if (uids.size === 0) return [];

    // Les plus récents d'abord : les UID croissent avec l'arrivée.
    const wanted = [...uids].sort((a, b) => b - a).slice(0, max);
    const messages: MailMessage[] = [];
    try {
      for await (const msg of client.fetch(
        wanted.join(","),
        { uid: true, envelope: true, bodyStructure: true, internalDate: true },
        { uid: true },
      )) {
        const mapped = this.toMessage(msg, path);
        if (mapped) messages.push(mapped);
      }
    } catch (error) {
      console.error("[imap] search fetch failed:", error);
    }

    return messages.sort((a, b) =>
      b.receivedDateTime.localeCompare(a.receivedDateTime),
    );
  }

  /**
   * Dépose un brouillon dans le dossier Brouillons de la boîte.
   *
   * Le courtier le retrouve dans son logiciel habituel, le relit et l'envoie
   * lui-même : la règle « rien ne part sans vous » est identique à celle du
   * connecteur Microsoft.
   */
  async createDraft(draft: MailDraft): Promise<MailDraftResult> {
    const client = await this.connect();

    const raw = await buildMimeMessage({
      from: this.config.address,
      to: draft.to,
      cc: draft.cc,
      subject: draft.subject,
      body: draft.body,
      attachments: draft.attachments,
    });

    // Le dossier des brouillons n'a pas de nom normalisé : \Drafts est l'attribut
    // standard, mais tous les serveurs ne l'exposent pas.
    const candidates = ["\\Drafts", "Drafts", "Brouillons", "INBOX.Drafts"];
    for (const path of candidates) {
      try {
        const result = await client.append(path, raw, ["\\Draft", "\\Seen"]);
        if (result) return { ok: true, email: this.address };
      } catch {
        // Dossier absent sous ce nom : on tente le suivant.
      }
    }
    return {
      ok: false,
      message:
        "Le brouillon n’a pas pu être déposé : dossier « Brouillons » introuvable sur la boîte.",
    };
  }
}

/** Compose un message MIME complet via nodemailer, sans l'envoyer. */
async function buildMimeMessage(input: {
  from: string;
  to: string;
  cc?: string[];
  subject: string;
  body: string;
  attachments?: { filename: string; contentType: string; contentBase64: string }[];
}): Promise<Buffer> {
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });
  const info = await transport.sendMail({
    from: input.from,
    to: input.to,
    cc: input.cc?.length ? input.cc : undefined,
    subject: input.subject,
    text: input.body,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      content: Buffer.from(a.contentBase64, "base64"),
    })),
  });
  return info.message as Buffer;
}

/**
 * Vérifie des identifiants IMAP sans rien lire : c'est ce qui permet de dire
 * « c'est bon » ou « mot de passe refusé » au moment où le courtier connecte sa
 * boîte, plutôt que de le découvrir au premier briefing.
 */
export async function verifyImapCredentials(
  config: ImapConfig,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    lock.release();
    await client.logout();
    return { ok: true };
  } catch (error) {
    try {
      await client.close();
    } catch {
      // La connexion peut n'avoir jamais été établie.
    }
    // Message d'origine volontairement non renvoyé : il peut contenir la
    // bannière du serveur, voire l'identifiant.
    const raw = error instanceof Error ? error.message : "";
    console.error("[imap] verification failed:", raw);
    const authFailed = /auth|login|credential|password/i.test(raw);
    return {
      ok: false,
      message: authFailed
        ? "Identifiants refusés par le serveur de messagerie. Vérifiez l’adresse et le mot de passe."
        : "Connexion au serveur de messagerie impossible. Vérifiez le serveur et le port.",
    };
  }
}
