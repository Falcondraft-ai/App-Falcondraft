# FalconDraft App — Contexte projet pour Claude Code

FalconDraft App est l’application SaaS B2B de FalconDraft.

Elle permet aux clients de gérer leurs dossiers commerciaux, générer des propositions commerciales, devis, documents finaux, liens de signature et brouillons Gmail depuis une interface premium, simple et sécurisée.

Le projet n’est pas à reprendre de zéro. Une première phase initiale existe déjà. La priorité actuelle est de consolider l’existant, améliorer l’expérience utilisateur, renforcer le design premium et éviter tout rendu générique ou “IA”.

L’objectif est de transformer l’interface existante en une V1 sérieuse, propre, premium et commercialisable.

---

## 1. Priorité actuelle du projet

La priorité actuelle n’est pas d’ajouter un maximum de fonctionnalités.

La priorité est de :

- améliorer le design existant ;
- rendre l’interface plus premium ;
- éviter le rendu générique généré par IA ;
- clarifier les parcours utilisateur ;
- améliorer la hiérarchie visuelle ;
- renforcer la cohérence graphique ;
- améliorer les espacements, alignements, états vides, feedbacks et microcopy ;
- rendre le dashboard plus rassurant et professionnel ;
- conserver les fonctionnalités existantes ;
- ne pas casser la logique métier déjà présente.

Ne pas considérer que le projet commence de zéro.

Avant toute modification importante, inspecter l’existant et proposer des améliorations ciblées.

---

## 2. Positionnement produit

FalconDraft n’est pas une simple automatisation n8n.

FalconDraft est un système personnalisé d’automatisation commerciale qui permet aux entreprises de :

- gagner du temps sur la création de propositions commerciales ;
- standardiser leurs documents commerciaux ;
- améliorer leur réactivité commerciale ;
- produire des documents professionnels ;
- préparer des brouillons Gmail prêts à relire et envoyer ;
- centraliser leurs dossiers commerciaux dans une interface claire.

Le client ne doit pas voir la complexité technique.

Ne jamais exposer dans l’interface client les outils internes suivants :

- n8n ;
- Gamma ;
- Invoice Ninja ;
- Gotenberg ;
- DocuSeal ;
- webhooks ;
- APIs internes ;
- IDs techniques inutiles ;
- logs bruts.

Expérience client cible :

Je crée un dossier commercial
→ je renseigne les informations nécessaires
→ je lance une génération
→ je valide le résultat
→ j’obtiens ma proposition, mon devis, mon lien de signature et mon brouillon Gmail.

---

## 3. Stack technique cible

La stack cible de l’app est :

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase Postgres
- Supabase Auth
- Supabase RLS
- Drizzle ORM
- n8n
- Gamma
- Gmail API / OAuth Google
- Resend
- Stripe Billing
- Gotenberg
- DocuSeal
- PostHog
- Sentry
- Better Stack
- Cloudflare
- Vercel

---

## 4. Règles d’architecture

### Source de vérité

FalconDraft App est la source de vérité pour :

- les utilisateurs ;
- les organisations ;
- les workspaces ;
- les rôles ;
- les permissions ;
- les dossiers commerciaux ;
- les documents ;
- les statuts ;
- les connexions Gmail ;
- les configurations workflow ;
- la facturation ;
- les accès client.

n8n orchestre les automatisations, mais ne doit pas être la source de vérité pour les permissions ou l’identité utilisateur.

### Multi-client

FalconDraft est une application multi-client.

Chaque client appartient à une organisation Supabase.

Toutes les données client sensibles doivent être rattachées à un organization_id.

Chaque utilisateur ne doit voir que les données de son organisation.

La sécurité multi-client repose sur :

- organization_id ;
- Supabase Auth ;
- Supabase RLS ;
- vérifications serveur ;
- politiques d’accès strictes.

Ne jamais se contenter d’un filtrage frontend pour protéger des données client.

---

## 5. Supabase et RLS

Supabase RLS est obligatoire sur toutes les tables sensibles.

Tables sensibles typiques :

- organizations
- organization_members
- organization_invitations
- deals
- proposals
- documents
- workflow_configs
- workflow_runs
- email_connections
- generated_outputs
- billing tables
- audit logs

Avant de créer ou modifier une table contenant des données client :

1. vérifier la présence d’un organization_id si pertinent ;
2. définir les politiques RLS ;
3. vérifier les accès par rôle ;
4. tester qu’un utilisateur d’une organisation ne peut pas accéder aux données d’une autre.

Ne jamais désactiver RLS pour contourner un bug sans expliquer les risques.

---

## 6. Organisations et rôles

Chaque client dispose d’un workspace représenté par une organisation.

Les rôles côté client sont :

- manager : Gestionnaire
- member : Collaborateur
- viewer : Lecteur

Le rôle owner ne doit pas être utilisé comme rôle client classique.

Le rôle owner est réservé à la logique interne FalconDraft si nécessaire.

Dans l’interface client, afficher uniquement :

- Gestionnaire
- Collaborateur
- Lecteur

Ne jamais afficher owner au client.

L’admin interne FalconDraft ne doit jamais être visible pour les clients classiques.

---

## 7. Workflows n8n

FalconDraft ne doit pas dépendre d’un seul workflow universel hardcodé.

Le modèle cible est :

Interface commune FalconDraft
+
configuration workflow par organisation

Chaque client peut avoir :

- son webhook n8n ;
- ses prompts ;
- son template Gamma ;
- ses règles commerciales ;
- son style de proposition ;
- ses paramètres spécifiques.

La table workflow_configs sert à relier une organisation à ses workflows.

Structure cible :

workflow_configs
- id
- organization_id
- workflow_type
- n8n_webhook_url
- n8n_workflow_id
- status
- created_at
- updated_at

Types de workflows recommandés :

- call_summary
- proposal_generation
- proposal_validation
- final_document_generation
- email_draft_generation

Ne jamais hardcoder les URLs de webhooks n8n directement dans le code.

L’application doit lire la configuration dans Supabase, puis appeler le bon webhook selon :

- l’organisation ;
- le type de workflow ;
- le statut actif.

---

## 8. Gmail et OAuth

FalconDraft doit créer des brouillons Gmail, pas envoyer automatiquement les emails.

Le commercial garde toujours la main finale.

Flux attendu :

L’utilisateur connecte Gmail via OAuth
→ FalconDraft stocke les tokens de manière sécurisée
→ n8n génère le contenu
→ le backend FalconDraft crée le brouillon Gmail
→ l’utilisateur relit et envoie lui-même.

Règles importantes :

- Ne jamais demander le mot de passe Gmail du client.
- Ne jamais stocker un mot de passe Gmail.
- Utiliser OAuth Google.
- Demander uniquement les scopes nécessaires.
- Pour les brouillons Gmail, utiliser le scope minimal adapté.
- Ne pas lire la boîte mail si ce n’est pas nécessaire.
- Ne pas envoyer automatiquement sans validation utilisateur.
- Ne jamais logger les tokens OAuth.
- Chiffrer les tokens sensibles si nécessaire.

Resend sert aux emails système FalconDraft.

Gmail API sert aux brouillons commerciaux envoyés depuis le compte du client.

Ne pas confondre les deux.

---

## 9. Règle importante sur les dossiers commerciaux

Le champ name ou l’intitulé du dossier commercial est uniquement un repère interne.

Il ne doit jamais être utilisé comme nom officiel du projet client dans :

- une proposition commerciale ;
- un email ;
- un devis ;
- un document final.

Exemples de mauvais intitulés possibles :

- Test
- Propal machin
- Client relou
- À voir
- Entreprise 2

Donc l’IA ne doit pas utiliser ce champ comme source fiable.

Utiliser plutôt :

- client_company_name
- client_contact_name
- client_email
- transcript
- call_summary
- proposal_content
- amount_estimate
- documents
- company_context

Ajouter dans les prompts sensibles :

Important : n’utilise jamais l’intitulé interne du dossier commercial comme nom officiel du projet client. Base-toi uniquement sur le transcript, le compte-rendu, la société cliente et les informations explicitement données.

---

## 10. Direction design

L’interface doit être :

- premium ;
- sobre ;
- claire ;
- élégante ;
- rassurante ;
- professionnelle ;
- moderne sans être tape-à-l’œil ;
- dense mais lisible ;
- orientée productivité B2B.

Éviter absolument :

- le design générique “IA” ;
- les gradients violets trop évidents ;
- les cartes trop nombreuses sans hiérarchie ;
- les ombres excessives ;
- les animations inutiles ;
- les interfaces trop vides ;
- les composants sans intention ;
- les dashboards qui ressemblent à un template SaaS basique ;
- les textes placeholders vagues ;
- les icônes décoratives sans rôle.

Privilégier :

- une hiérarchie visuelle forte ;
- des espacements précis ;
- une typographie cohérente ;
- des composants sobres ;
- des états vides utiles ;
- des messages d’aide courts ;
- des actions principales évidentes ;
- des feedbacks clairs après action ;
- une impression de fiabilité.

Utiliser les skills design disponibles quand pertinent :

- impeccable pour audit, polish, design system, interface premium ;
- frontend-design pour créer ou améliorer des composants frontend distinctifs ;
- ne pas activer plusieurs skills design en même temps sans raison.

---

## 11. Expérience utilisateur cible

Ne pas créer une interface trop technique.

Ne pas afficher :

- logs n8n bruts ;
- IDs techniques inutiles ;
- payloads JSON ;
- noms d’outils internes ;
- erreurs techniques non reformulées.

Les erreurs doivent être compréhensibles côté utilisateur.

Mauvais exemple :

Webhook 500: Cannot read property data of undefined

Bon exemple :

La génération n’a pas pu être finalisée. Veuillez réessayer ou contacter le support.

L’interface doit donner l’impression que FalconDraft est un système fiable, pas une suite d’outils assemblés.

---

## 12. Pages principales de l’application

L’application FalconDraft doit progressivement contenir :

- Dashboard
- Dossiers commerciaux
- Détail d’un dossier
- Documents
- Générations
- Intégrations
- Connexion Gmail
- Paramètres workspace
- Équipe
- Facturation
- Admin interne FalconDraft

L’admin interne ne doit jamais être visible pour les clients classiques.

---

## 13. Statuts recommandés

Les générations doivent avoir des statuts clairs.

Exemples :

- draft
- pending
- processing
- generated
- validated
- failed
- cancelled

Pour les workflows :

- queued
- running
- success
- failed
- retrying
- cancelled

Toujours prévoir un état d’erreur propre.

---

## 14. Documents

Les documents générés doivent être rattachés à :

- organization_id
- deal_id
- created_by
- document_type
- status
- file_url ou storage path
- created_at

Types possibles :

- call_summary
- proposal
- quote
- final_pdf
- signature_link
- email_draft

---

## 15. Paiement et abonnement

FalconDraft fonctionne avec :

- setup initial ;
- abonnement mensuel.

Stripe Billing doit gérer :

- abonnements ;
- statuts de paiement ;
- éventuelle suspension ;
- portail client ;
- webhooks Stripe.

Le statut de facturation doit influencer l’accès au service.

Exemples :

- active
- trial
- past_due
- cancelled
- suspended

---

## 16. Monitoring et analytics

### Sentry

Sentry sert à suivre les bugs techniques :

- erreurs frontend ;
- erreurs backend ;
- erreurs API ;
- erreurs OAuth ;
- erreurs Supabase ;
- erreurs workflow ;
- erreurs serveur.

### PostHog

PostHog sert à suivre les événements produit, pas les contenus sensibles.

Événements possibles :

- user_signed_up
- organization_created
- deal_created
- call_summary_generated
- proposal_generated
- proposal_validated
- final_pdf_created
- gmail_connected
- gmail_draft_created
- workflow_failed

Ne jamais envoyer dans PostHog :

- contenu des appels ;
- emails complets ;
- propositions commerciales complètes ;
- devis complets ;
- tokens ;
- données sensibles client.

### Better Stack

Better Stack sert au monitoring d’uptime et d’incidents.

Services à surveiller :

- app FalconDraft ;
- API FalconDraft ;
- n8n ;
- Gotenberg ;
- DocuSeal ;
- Invoice Ninja si utilisé ;
- endpoints de santé ;
- webhooks critiques.

---

## 17. Sécurité

Règles générales :

- Ne jamais exposer de secrets côté client.
- Ne jamais mettre de secrets dans le code.
- Ne jamais commit .env.
- Ne jamais logger les tokens OAuth.
- Ne jamais logger les secrets API.
- Ne jamais afficher de données client dans des logs publics.
- Chiffrer les tokens sensibles si nécessaire.
- Valider les permissions côté serveur.
- Utiliser RLS côté base.
- Protéger les endpoints sensibles.
- Utiliser Cloudflare pour DNS, sécurité, WAF et protection des sous-domaines sensibles.

Fichiers et variables sensibles à ne jamais exposer :

- .env
- .env.local
- .env.production
- SUPABASE_SERVICE_ROLE_KEY
- GOOGLE_CLIENT_SECRET
- TOKEN_ENCRYPTION_KEY
- N8N secrets
- STRIPE_SECRET_KEY
- RESEND_API_KEY
- POSTHOG secrets
- SENTRY auth token

Utiliser le skill owasp-security pour toute tâche liée à :

- Auth ;
- RLS ;
- OAuth ;
- webhooks ;
- API routes ;
- permissions ;
- stockage de tokens ;
- Stripe ;
- données client sensibles.

---

## 18. Debug

Utiliser le skill systematic-debugging pour :

- erreurs de build ;
- bugs non compris ;
- problèmes Supabase ;
- erreurs RLS ;
- erreurs OAuth ;
- bugs n8n/backend ;
- erreurs Vercel ;
- problèmes TypeScript ;
- comportements inattendus.

Ne pas corriger au hasard.

Toujours chercher la cause racine avant de modifier.

---

## 19. Conventions de développement

Avant de modifier du code :

1. lire uniquement les fichiers nécessaires ;
2. comprendre la structure existante ;
3. proposer un plan court si la tâche est importante ;
4. modifier seulement les fichiers concernés ;
5. éviter les refactors globaux non demandés ;
6. ne pas changer le design global sans demande ;
7. ne pas modifier la base de données sans expliquer ;
8. ne pas modifier les règles RLS sans prudence ;
9. ne pas modifier les flows d’auth sans expliquer ;
10. tester si possible.

---

## 20. Commandes utiles

Installer les dépendances :

npm install

Lancer le développement :

npm run dev

Lint :

npm run lint

Build :

npm run build

Typecheck si disponible :

npm run typecheck

Voir l’état Git :

git status

Voir les modifications :

git diff

---

## 21. Règles pour Claude Code

Claude Code doit respecter ces règles :

- Lire ce fichier avant de travailler.
- Ne pas lire tout le repo inutilement.
- Ne pas modifier des fichiers non concernés.
- Ne pas faire de refactor global sans demande explicite.
- Ne pas supprimer des fonctionnalités existantes sans validation.
- Ne pas modifier les flows sensibles sans expliquer les impacts.
- Ne pas hardcoder de secrets.
- Ne pas hardcoder de webhooks client.
- Ne pas hardcoder de données client.
- Ne pas inventer une architecture différente si celle-ci est déjà définie.
- Garder une logique premium, simple et professionnelle.
- Toujours préserver la sécurité multi-client.
- Toujours préserver l’isolation par organisation.
- Toujours garder FalconDraft App comme source de vérité.
- Toujours garder n8n comme moteur d’orchestration, pas comme source de permissions.
- Préserver l’existant et améliorer progressivement.
- Ne pas repartir de zéro sauf demande explicite.

---

## 22. Quand une tâche est demandée

Pour chaque tâche, Claude Code doit :

1. identifier les fichiers probablement concernés ;
2. lire uniquement ces fichiers ;
3. proposer un plan court si nécessaire ;
4. appliquer les changements ;
5. lister les fichiers modifiés ;
6. expliquer brièvement ce qui a été fait ;
7. donner les commandes à lancer pour vérifier.

---

## 23. Priorité actuelle

La priorité actuelle est de finaliser une V1 premium et propre de FalconDraft App à partir de l’existant.

Ordre de priorité :

1. Amélioration design et UX de l’existant.
2. Cohérence visuelle globale.
3. Dashboard plus premium.
4. Parcours utilisateur plus clair.
5. États vides et messages d’aide.
6. Responsive propre.
7. Sécurité multi-client.
8. Authentification propre.
9. Organisations et workspaces.
10. RLS.
11. Dossiers commerciaux.
12. Connexion avec n8n via workflow_configs.
13. Gestion des statuts de génération.
14. Documents générés.
15. OAuth Gmail.
16. Création de brouillons Gmail.
17. Stripe Billing.
18. Monitoring et sécurité.

Ne pas ajouter de nouvelles fonctionnalités complexes tant que l’interface existante n’est pas suffisamment propre, premium et cohérente.

---

## 24. Style de code attendu

Le code doit être :

- clair ;
- typé ;
- maintenable ;
- lisible ;
- sécurisé ;
- cohérent avec l’architecture existante.

Éviter :

- les fichiers trop longs ;
- les composants trop complexes ;
- les duplications inutiles ;
- les hacks rapides ;
- les any inutiles ;
- les noms flous ;
- les commentaires inutiles ;
- les variables non utilisées.

---

## 25. Rappel final

FalconDraft App doit donner une impression de produit sérieux, premium et maîtrisé.

Le client ne doit jamais sentir :

- outil bricolé ;
- automatisation fragile ;
- n8n visible ;
- stack technique exposée ;
- process compliqué ;
- design générique IA ;
- template SaaS sans âme.

Il doit sentir :

- système clair ;
- gain de temps ;
- documents propres ;
- expérience premium ;
- sécurité ;
- accompagnement ;
- fiabilité ;
- produit maîtrisé.
