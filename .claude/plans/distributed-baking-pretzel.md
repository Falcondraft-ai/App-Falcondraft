# Plan — Refonte de l'espace courtier « sur mesure » (Lot 1)

## Contexte

L'espace **courtier sur mesure** (`broker_offering = custom`) a été construit comme un CRM courtage générique : il embarque des modules dont le client réel n'a pas l'usage (apporteurs d'affaires, recueil de besoins structuré, conformité DDA/LCB-FT/RGPD, commissions, sinistres) et un dossier client en lecture seule au rendu « template SaaS / IA générique ».

Objectif : transformer cet espace en un **CRM courtage automatisé, premium et fortement brandé** (direction **éditorial premium navy + or**, Fraunces assumé). On retire le superflu, on rend le dossier entièrement éditable et beau, on met le **devoir de conseil** (+ signature électronique + brouillon email) au centre, on rattache automatiquement les **emails** à chaque dossier, on enrichit la **recherche**, on rebranche la file **« À valider »** sur les réflexions de l'IA, et on étend l'**assistant** pour qu'il agisse réellement (éditer un dossier, ranger une PJ, lier un mail). La reconnaissance auto d'un client revenant + l'extraction depuis PJ sont **hors lot 1** (lot 2 dédié).

Décisions validées :
- **Branches fixes** (non modifiables) : **Immobilier · Vie · Auto · Pro (entreprises)**.
- **Commissions & Sinistres** : conservés **uniquement pour l'offre Courtier SaaS** (`hasProposalAutomation`), retirés de l'offre sur mesure.
- **Lot 1** = UI/redesign + fondations IA (ci-dessous). Pas de reconnaissance auto / extraction PJ.
- **Direction visuelle** = Éditorial premium (navy + or), titres Fraunces.

⚠️ On ne touche **que** l'espace courtier (`app/courtier`, `components/broker`, `app/api/broker`, `app/api/courtier`, `lib/broker`) + `lib/email`. Aucun impact sur le SaaS dossiers (`/dashboard`). On préserve RLS / isolation `organization_id`.

---

## A. Branches fixes (Immobilier · Vie · Auto · Pro)

- `lib/broker/clients.ts` : remplacer `brokerInsuranceTypes` / `brokerInsuranceTypeLabels` par **`immobilier`, `vie`, `auto`, `pro`** (labels : Immobilier, Vie, Auto, Pro). Garder `insuranceTypeLabel()` tolérant (retombe sur la valeur brute pour les anciennes données type `sante`/`habitation`).
- `lib/broker/settings.ts` : `enabledBranches` n'est plus configurable côté sur mesure → renvoyer la liste fixe des 4 branches ; conserver `partnerInsurers`.
- Partout où une branche est saisie (formulaire nouveau dossier `components/broker/new-client-form.tsx`, contrats `components/broker/contract-form.tsx`, filtres de liste `app/courtier/clients/page.tsx`) : `<select>` figé sur les 4 branches.
- Migration légère de relabel à prévoir côté data si besoin (non bloquant : `insuranceTypeLabel` affiche la valeur brute pour l'existant).

## B. Nettoyage des modules inutiles (offre sur mesure)

- **Apporteurs** : retirer la carte « Apporteur » du dossier (`app/courtier/clients/[id]/page.tsx`), le composant `client-introducer-select`, la page `app/courtier/settings/apporteurs`, l'onglet dans `components/broker/courtier-settings-nav.tsx`. `introducersEnabled` → `false` pour le sur mesure.
- **Recueil de besoins** : retirer la carte « Recueil de besoins » + `needs-questionnaire` du dossier. On garde **uniquement la branche** (champ B) et les **notes internes**. `buildAdviceTemplate` (`lib/broker/advice.ts`) ne dépend plus des `structured_needs` : il s'appuie sur branche + dernier devis validé + infos client + notes.
- **Conformité DDA/LCB-FT/RGPD** : retirer la carte du dossier, la page `app/courtier/settings/conformite`, l'onglet de nav, et `compliance-panel` / `compliance-settings-form` côté sur mesure. `complianceEnabled` → `false`.
- **Commissions & Sinistres** : **gating par offre SaaS** (pas suppression du code).
  - `components/broker/courtier-shell.tsx` : sortir les items `Commissions` et `Sinistres` de `baseNavSections` → nouvelle section gatée affichée seulement si `showProposals` (offre SaaS).
  - `app/courtier/clients/[id]/page.tsx` : cartes Commissions / Sinistres rendues seulement si `hasProposalAutomation(organization)` (`lib/broker/access.ts`).
  - `lib/broker/agent-tools.ts` : `get_commission_summary` / `get_open_claims` retirés des définitions exposées quand l'offre n'est pas SaaS (filtrer `agentToolDefinitions` selon l'offre dans `app/api/courtier/agent/route.ts`).

## C. Dossier client — refonte premium + 100% éditable

Fichier pivot : `app/courtier/clients/[id]/page.tsx` (+ nouveaux composants `components/broker/`).

- **En-tête éditorial** : eyebrow or « DOSSIER · {BRANCHE} », titre **Fraunces** (`var(--font-heading)`), badge statut, avatar dossier (squircle dégradé navy + initiales or — cf. section G).
- **Édition inline de tout** : nouveau `client-info-editor.tsx` (client component) — bouton « Modifier », champs nom/type/email/téléphone/adresse/CP/ville/branche/notes, `PATCH /api/broker/clients/[id]` (route **déjà compatible**, aucun changement backend). Optimistic + `router.refresh()`.
- **Réorganisation en colonnes** : colonne principale = Infos client (éditable) → **Devoir de conseil (mis en avant, cf. D)** → Contrats (avec date de renouvellement visible, cf. E) → Devis compagnie → Documents → **Emails du dossier (cf. F)**. Rail = Historique. Retrait des cartes apporteur/besoins/conformité.
- Cartes harmonisées (tokens `--bg-surface`, `--border-1`, `--shadow-sm`, radius), hiérarchie claire, états vides soignés et brandés (pas de placeholders vagues).

## D. Devoir de conseil — mise en avant + UX signature & brouillon email

- Dans le dossier, le devoir de conseil devient un **bloc proéminent** (en haut de colonne principale), pas une carte parmi d'autres.
- Refondre la page détail `app/courtier/clients/[id]/advice/[adviceId]/page.tsx` + `advice-editor.tsx` / `advice-signature-panel.tsx` :
  - **Parcours en étapes claires** : 1) Rédiger/valider le contenu → 2) Signature électronique → 3) Brouillon email d'envoi. Stepper visuel brandé.
  - **Signature électronique** (`advice-signature-panel.tsx`) : UX claire autour de `signature_url` / `signature_status` / `docuseal_submission_id` (champs DB existants) — état « en attente / signé », copie du lien, relance. (Création DocuSeal auto = hors lot 1, on garde l'enregistrement manuel du lien mais présenté proprement.)
  - **Brouillon email** : bouton « Préparer le brouillon Outlook » via la route existante `app/api/broker/clients/[id]/advice/[adviceId]/outlook-draft/route.ts` (utilise `outlook_draft_id`), feedback clair + lien « Ouvrir dans Outlook ».
- `advice-status-badge.tsx` : statuts plus lisibles.

## E. Renouvellements — date au niveau du contrat (déjà en base)

- `broker_contracts.renewal_date` + `tacit_renewal` **existent déjà** et alimentent le dashboard + l'assistant. Lot 1 = les **rendre visibles/éditables proprement** dans la carte Contrats du dossier (`contract-manager.tsx` / `contract-form.tsx`) : date de renouvellement + badge d'urgence (`renewalUrgency` / `renewalUrgencyTone` de `lib/broker/contracts.ts`), tacite reconduction.

## F. Emails rattachés au dossier (auto par adresse) + recherche

- **Lib** `lib/email/outlook-read.ts` : ajouter `searchMessagesByParticipant(accessToken, email, query?)` — Graph `/me/messages` avec `$search="participants:{email}"` (ou filtre from/toRecipients), renvoie les messages où l'adresse du client apparaît en expéditeur/destinataire. Couvre nativement le **multi-adresses** (un compte Outlook agrégeant plusieurs SMTP est lu en entier).
- **API** `app/api/broker/clients/[id]/emails/route.ts` (nouveau) : récupère l'email du client, appelle la lib, supporte `?q=` (recherche), renvoie une liste live (pas de table — rattachement = match d'adresse).
- **UI** `components/broker/client-emails.tsx` (nouveau) : section « Emails du client » dans le dossier, **barre de recherche** intégrée, liste des mails (expéditeur, objet, date, lien Outlook, PJ). État vide si pas d'email client renseigné / Outlook non connecté.

## G. Recherche globale enrichie (RIB, compagnie, adresse…)

- `app/api/broker/search/route.ts` : élargir au-delà des seuls noms/email. Rechercher aussi :
  - `broker_clients` : adresse, ville, CP, téléphone (en plus de nom/email/société) ;
  - `broker_contracts` : `insurer_name`, `product_name`, `policy_number` (→ « compagnie ») ;
  - `broker_documents` : `title`, `file_name` (→ « RIB » via doc intitulé RIB) ;
  - regrouper les résultats par type (Client / Contrat / Document) avec libellé.
- `components/broker/courtier-topbar-search.tsx` : affichage groupé des résultats hétérogènes + placeholder « Rechercher un client, une compagnie, un RIB, une adresse… ».
- (RIB en tant que champ dédié = note lot 2 ; lot 1 le couvre via documents + notes.)

## H. Dashboard — « À valider » = réflexions de l'IA

- `app/courtier/page.tsx` + `components/broker/daily-briefing.tsx` : remplacer `AttentionPanel` (qui liste des dossiers par statut) par un vrai panneau **« À valider »** alimenté par les **suggestions d'emails en attente** (`broker_email_suggestions`, statut `pending`) — les actions que l'IA propose (créer un dossier, ranger une PJ, brouillon de réponse, signaler une échéance…).
  - Réutiliser `suggestionDescription` + la route de résolution existante `app/api/courtier/outlook/suggestions/[suggestionId]/route.ts` pour **valider/ignorer en un clic** depuis le dashboard.
  - Garder un accès secondaire aux dossiers en attente (advice_ready / awaiting_signature) plus bas si pertinent.
- Le stat-card « Devoirs de conseil à valider » reste mais pointe vers le bon flux.

## I. Assistant Outlook — page redesign + actions par email + multi-adresses

- `components/broker/outlook-digest.tsx` (+ `app/courtier/inbox/page.tsx`) : refonte visuelle brandée (éditorial premium), hiérarchie plus claire des catégories.
- **Actions par email** : menu d'actions sur chaque email (ex. un « devis reçu ») — **Rattacher à un dossier**, **Brouillon de réponse**, **Créer un dossier**, **Écarter/Supprimer**. S'appuyer sur les types de suggestion existants (`attach_document`, `draft_reply`, `create_client`) + l'action item keep/exclude existante (`app/api/courtier/outlook/items/[itemId]/route.ts`).
- **Multi-adresses** : afficher les adresses couvertes par la boîte connectée (header de page), texte explicatif. Documenter dans `app/courtier/settings/integrations/page.tsx` que toutes les adresses agrégées dans le compte Outlook sont lues (ne bloque pas).

## J. Assistant IA — outils étendus (« il fait vraiment tout »)

`lib/broker/agent-tools.ts` (+ exposition dans `app/api/courtier/agent/route.ts`). Nouveaux outils write (gardés par `canWrite`) :
- `update_client` : modifie email/téléphone/adresse/CP/ville/branche/notes/nom/société d'un dossier (réutilise la logique du PATCH).
- `find_client_by_email` : retrouve un dossier par adresse email (fondation de la reco « client revenant » du lot 2).
- `list_contracts` / `get_contract` : lire les contrats d'un dossier (échéances, compagnie, prime).
- `attach_email_attachment_to_client` : range une PJ Outlook dans le dossier — `getMessageAttachmentsMeta` + `getFileAttachmentBytes` (déjà dans `lib/email/outlook-read.ts`) → upload `broker_documents` via `lib/broker/storage.ts` (respecter le quota `computeStorageUsage`).
- Mettre à jour le prompt système de l'agent pour décrire ces capacités.

## K. Branding & polices — « éditorial premium, moins générique »

- **Fraunces réellement appliqué** : Fraunces + Instrument Sans sont déjà chargées (`app/layout.tsx`, `--font-heading` / `--font-sans`). Les pages courtier utilisent partout `--font-sans` pour les titres → appliquer `var(--font-heading)` (Fraunces) aux **titres de page / en-têtes de dossier / headings de section** courtier (classe utilitaire dédiée, ex. `fd-heading`), accents or (`--accent` / `--brand-amber-*`) sur navy profond. Vérifier les utilitaires existants (`fd-eyebrow`, etc.) dans `app/globals.css`.
- **Avatar / bloc compte (bas de sidebar)** : redesign de `AccountBlock` (`courtier-shell.tsx`) — squircle `rounded-[12px]`, dégradé navy soigné + initiales or, `ring` subtil, micro-interaction discrète (pas de scale générique), dropdown brandé. Extraire un composant avatar réutilisable et l'appliquer aussi aux avatars dossier/expéditeur (`outlook-digest.tsx`, en-tête dossier).
- **Micro-interactions** : remplacer les hovers/transitions génériques (opacity brute, scale par défaut) par des transitions cohérentes (couleur/translate fins 150 ms), états focus visibles, sur les zones les plus visibles (sidebar, cartes, boutons, lignes de tableau).

## L. Paramètres — cohérence avec le nettoyage

- `components/broker/courtier-settings-nav.tsx` : retirer **Apporteurs** et **Conformité** (offre sur mesure). Onglets restants : Général, Types de contrat (branches fixes affichées en lecture seule + compagnies partenaires), Équipe & accès, Stockage, Intégrations (+ Facturation SaaS).
- `app/courtier/settings/page.tsx` : ShortcutCards mis à jour (plus de renvoi conformité/apporteurs), wording cohérent.
- `app/courtier/settings/contrats/page.tsx` : branches non éditables (les 4), focus compagnies partenaires.

---

## Fichiers principaux touchés

- Données/logique : `lib/broker/clients.ts`, `lib/broker/settings.ts`, `lib/broker/advice.ts`, `lib/broker/agent-tools.ts`, `lib/broker/access.ts`, `lib/email/outlook-read.ts`
- API : `app/api/broker/search/route.ts`, `app/api/broker/clients/[id]/emails/route.ts` (nouveau), `app/api/courtier/agent/route.ts`
- Pages : `app/courtier/page.tsx`, `app/courtier/clients/[id]/page.tsx`, `app/courtier/clients/[id]/advice/[adviceId]/page.tsx`, `app/courtier/inbox/page.tsx`, `app/courtier/settings/*`
- Composants : `courtier-shell.tsx`, `daily-briefing.tsx`, `outlook-digest.tsx`, `contract-manager.tsx`/`contract-form.tsx`, `advice-editor.tsx`/`advice-signature-panel.tsx`, `new-client-form.tsx`, `courtier-settings-nav.tsx`, `courtier-topbar-search.tsx`, + nouveaux `client-info-editor.tsx`, `client-emails.tsx`, composant avatar partagé
- Suppression d'usage (offre sur mesure) : `client-introducer-select`, `needs-questionnaire`, `compliance-panel`, `compliance-settings-form` ; pages `settings/apporteurs`, `settings/conformite`

## Réutilisation (existant)

- PATCH dossier déjà complet : `app/api/broker/clients/[id]/route.ts` (tous champs éditables) → pas de backend pour l'édition.
- Outlook : `getOutlookAccessForUser`, `getMessageAttachmentsMeta`, `getFileAttachmentBytes`, `getOutlookMessageBody`, `createOutlookDraft`.
- Renouvellements : `renewalUrgency`, `renewalUrgencyTone`, `daysUntil` (`lib/broker/contracts.ts`).
- Suggestions IA : `suggestionDescription` + routes `app/api/courtier/outlook/suggestions/[id]` et `items/[id]`.
- Gate offre : `hasProposalAutomation` / `isBrokerWorkspace` (`lib/broker/access.ts`), `showProposals` du shell.

## Vérification

1. `npm run typecheck` puis `npm run lint` — clean obligatoire.
2. `npm run build`.
3. Manuel (offre **sur mesure**) : le menu n'affiche plus Commissions/Sinistres ; dossier sans apporteur/besoins/conformité ; édition inline de toutes les infos OK (persistées) ; branches limitées aux 4 ; devoir de conseil proéminent + parcours signature + brouillon email ; date de renouvellement visible ; section Emails du dossier avec recherche ; recherche globale trouve compagnie/adresse/document ; dashboard « À valider » liste les suggestions IA et valide en un clic ; assistant exécute update_client / range une PJ / lit un contrat.
4. Manuel (offre **SaaS**) : Commissions/Sinistres toujours présents (non régressés).
5. Vérifier l'isolation `organization_id` sur la nouvelle route emails et les nouveaux outils agent (RLS / `requireBrokerApiContext`).
