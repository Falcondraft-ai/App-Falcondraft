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
    this.client = client;
    return client;
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

  private toMessage(msg: FetchMessageObject): MailMessage | null {
    const envelope = msg.envelope;
    if (!envelope) return null;

    const parts = flattenParts(msg.bodyStructure as RawBodyStructure | undefined);
    const from = envelope.from?.[0];
    // Message-ID plutôt que l'UID : il est stable même si le serveur renumérote
    // (changement d'UIDVALIDITY), ce qui évite de re-présenter toute la boîte
    // comme du courrier neuf.
    const id = envelope.messageId?.trim() || `imap:${msg.uid}`;

    this.cache.set(id, {
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

  async listInbox(
    sinceIso: string,
    max: number,
    options?: { order?: "asc" | "desc" },
  ): Promise<MailboxPage> {
    const client = await this.connect();
    const limit = Math.min(Math.max(max, 1), HARD_MAX);
    const since = new Date(sinceIso);

    const collected: MailMessage[] = [];
    try {
      // IMAP SEARCH est à la journée près : on redemande la veille et on affine
      // ensuite sur l'horodatage réel, sinon on perdrait les emails du jour de
      // reprise.
      const searchSince = new Date(since.getTime() - 86_400_000);
      for await (const msg of client.fetch(
        { since: searchSince },
        { uid: true, envelope: true, bodyStructure: true, internalDate: true },
        { uid: true },
      )) {
        const mapped = this.toMessage(msg);
        if (!mapped) continue;
        if (new Date(mapped.receivedDateTime).getTime() < since.getTime()) continue;
        collected.push(mapped);
        // Le serveur renvoie par ordre d'arrivée croissant : dès qu'on a de quoi
        // remplir la fenêtre (plus un, pour savoir s'il en reste), on arrête. Un
        // rattrapage de trois semaines représente des milliers de messages qu'il
        // serait absurde de charger pour n'en garder que quelques centaines.
        if (options?.order !== "desc" && collected.length > limit) break;
      }
    } catch (error) {
      console.error("[imap] list failed:", error);
      return { messages: collected, truncated: collected.length > 0 };
    }

    collected.sort((a, b) =>
      a.receivedDateTime.localeCompare(b.receivedDateTime),
    );

    if (options?.order === "desc") {
      const newestFirst = [...collected].reverse();
      return { messages: newestFirst.slice(0, limit), truncated: false };
    }

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

    const client = await this.connect();
    try {
      const uids = await client.search(
        { header: { "message-id": messageId } },
        { uid: true },
      );
      const uid = Array.isArray(uids) ? uids[uids.length - 1] : undefined;
      if (!uid) return null;

      const msg = await client.fetchOne(
        String(uid),
        { uid: true, envelope: true, bodyStructure: true, internalDate: true },
        { uid: true },
      );
      if (!msg) return null;
      this.toMessage(msg);
      return this.cache.get(messageId) ?? null;
    } catch (error) {
      console.error("[imap] resolve failed:", error);
      return null;
    }
  }

  private async downloadPart(uid: number, part: string): Promise<Buffer | null> {
    const client = await this.connect();
    try {
      const { content } = await client.download(String(uid), part, { uid: true });
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
      entry.htmlPart ? this.downloadPart(entry.uid, entry.htmlPart) : null,
      entry.textPart ? this.downloadPart(entry.uid, entry.textPart) : null,
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

    const buffer = await this.downloadPart(entry.uid, attachmentId);
    if (!buffer) return null;

    return {
      name: part.filename || `piece-jointe-${part.part}`,
      contentType: part.type || "application/octet-stream",
      contentBase64: buffer.toString("base64"),
    };
  }

  async searchForClient(
    criteria: MailSearchCriteria,
    query?: string,
    max = 30,
  ): Promise<MailMessage[]> {
    const client = await this.connect();

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
        const mapped = this.toMessage(msg);
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
