/**
 * Vérification d'accès IMAP — outil de mise en service.
 *
 * Sert à contrôler qu'une boîte répond avant de la relier à un profil de
 * cabinet, sans passer par l'interface. Utile quand on prépare plusieurs boîtes
 * d'un coup ou qu'on diagnostique un refus d'authentification.
 *
 * Les identifiants ne sont JAMAIS écrits ici ni en argument de ligne de
 * commande (ils resteraient dans l'historique du shell) : ils arrivent par la
 * variable d'environnement IMAP_ACCOUNTS, au format
 *
 *   [{"user":"...","pass":"...","host":"imap.ionos.fr","port":993}]
 *
 * `host` et `port` sont facultatifs (défaut : imap.ionos.fr:993).
 *
 * Usage :
 *   IMAP_ACCOUNTS='[…]' node scripts/verify-imap.mjs
 *
 * Rien n'est lu ni modifié dans la boîte : on ouvre la session, on verrouille
 * INBOX, on compte les messages, on se déconnecte.
 */
import { ImapFlow } from "imapflow";

const raw = process.env.IMAP_ACCOUNTS;
if (!raw) {
  console.error(
    "IMAP_ACCOUNTS manquant. Exemple :\n" +
      `  IMAP_ACCOUNTS='[{"user":"contact@cabinet.fr","pass":"…"}]' node scripts/verify-imap.mjs`,
  );
  process.exit(1);
}

let accounts;
try {
  accounts = JSON.parse(raw);
  if (!Array.isArray(accounts)) throw new Error("attendu : un tableau");
} catch (error) {
  console.error(`IMAP_ACCOUNTS illisible : ${error.message}`);
  process.exit(1);
}

let failures = 0;

for (const account of accounts) {
  const host = account.host || "imap.ionos.fr";
  const port = account.port || 993;
  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user: account.user, pass: account.pass },
    // Le logger d'ImapFlow recrache les commandes, donc les identifiants.
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    const count = client.mailbox?.exists ?? "?";
    lock.release();
    await client.logout();
    console.log(`OK     ${account.user}  —  ${count} message(s) dans INBOX`);
  } catch (error) {
    failures += 1;
    try {
      await client.close();
    } catch {
      // La connexion peut n'avoir jamais été établie.
    }
    console.log(`ÉCHEC  ${account.user}  —  ${String(error.message).slice(0, 120)}`);
  }
}

process.exit(failures > 0 ? 1 : 0);
