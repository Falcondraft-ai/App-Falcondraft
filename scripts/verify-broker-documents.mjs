/**
 * Vérification de la GED courtier — outil de diagnostic.
 *
 * Répond à une seule question : pour chaque ligne de `broker_documents`, le
 * fichier est-il réellement présent dans le bucket `broker-files` ?
 *
 * Un aperçu ou un téléchargement qui échoue vient presque toujours de là : la
 * ligne existe en base, mais l'objet a disparu du stockage (import interrompu,
 * fichier supprimé côté Supabase, bucket recréé). L'interface ne peut que le
 * constater ; ce script dit COMBIEN de documents sont concernés et lesquels.
 *
 * Rien n'est modifié : lecture seule, du début à la fin.
 *
 * Usage :
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     node scripts/verify-broker-documents.mjs
 *
 * Optionnel : ORGANIZATION_ID=… pour ne vérifier qu'un cabinet.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const organizationId = process.env.ORGANIZATION_ID || null;

if (!url || !key) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.",
  );
  process.exit(1);
}

const BUCKET = "broker-files";
const admin = createClient(url, key, { auth: { persistSession: false } });

// --- Le bucket existe-t-il seulement ? ---------------------------------------
const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
if (bucketError) {
  console.error("Stockage injoignable :", bucketError.message);
  process.exit(1);
}
if (!buckets.some((b) => b.name === BUCKET)) {
  console.error(
    `Le bucket « ${BUCKET} » n'existe pas dans ce projet Supabase.\n` +
      "→ Appliquez la migration 0032. Aucun document ne peut être lu tant qu'il manque.",
  );
  process.exit(1);
}
console.log(`Bucket « ${BUCKET} » : présent.`);

// --- Les lignes de la GED ----------------------------------------------------
let query = admin
  .from("broker_documents")
  .select("id, organization_id, client_id, title, storage_path, created_at")
  .order("created_at", { ascending: true });
if (organizationId) query = query.eq("organization_id", organizationId);

const { data: documents, error: docsError } = await query;
if (docsError) {
  console.error("Lecture de broker_documents impossible :", docsError.message);
  process.exit(1);
}
if (!documents || documents.length === 0) {
  console.log("Aucun document enregistré.");
  process.exit(0);
}
console.log(`${documents.length} document(s) à vérifier.\n`);

// --- Un listage par dossier, pas un par fichier ------------------------------
// `list` est paginé à 100 par défaut : on remonte tout le dossier une fois,
// puis on croise en mémoire. Mille documents = quelques dizaines d'appels au
// lieu de mille.
const byFolder = new Map();
for (const doc of documents) {
  const cut = doc.storage_path.lastIndexOf("/");
  const folder = cut > 0 ? doc.storage_path.slice(0, cut) : "";
  if (!byFolder.has(folder)) byFolder.set(folder, []);
  byFolder.get(folder).push(doc);
}

const missing = [];
for (const [folder, docs] of byFolder) {
  const present = new Set();
  for (let offset = 0; ; offset += 100) {
    const { data: listed, error } = await admin.storage
      .from(BUCKET)
      .list(folder, { limit: 100, offset });
    if (error) {
      console.error(`  dossier ${folder} illisible : ${error.message}`);
      break;
    }
    for (const item of listed ?? []) present.add(item.name);
    if (!listed || listed.length < 100) break;
  }
  for (const doc of docs) {
    const name = doc.storage_path.slice(folder.length + 1);
    if (!present.has(name)) missing.push(doc);
  }
}

// --- Verdict -----------------------------------------------------------------
if (missing.length === 0) {
  console.log("Tous les fichiers sont présents dans le stockage.");
  console.log(
    "→ Si un aperçu échoue malgré tout, la cause est ailleurs : relevez la ligne\n" +
      "  [broker] lien signé impossible dans les journaux du serveur.",
  );
  process.exit(0);
}

console.log(
  `${missing.length} document(s) sur ${documents.length} n'ont PLUS de fichier :\n`,
);
for (const doc of missing.slice(0, 50)) {
  console.log(
    `  · ${doc.title}\n    dossier ${doc.client_id} — ${doc.storage_path} — ajouté le ${doc.created_at}`,
  );
}
if (missing.length > 50) {
  console.log(`  … et ${missing.length - 50} autre(s).`);
}
console.log(
  "\n→ Ces lignes pointent dans le vide : elles ne peuvent être ni ouvertes ni\n" +
    "  téléchargées. Supprimez-les depuis le dossier, ou réimportez les fichiers.",
);
