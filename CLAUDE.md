# CLAUDE.md — FalconDraft App

## Contexte produit

FalconDraft App est l'application SaaS B2B de FalconDraft.

Elle permet aux clients de gérer leurs dossiers commerciaux, générer des propositions commerciales, devis, documents finaux, liens de signature et brouillons Gmail depuis une interface premium, simple et sécurisée.

Le projet n'est pas à reprendre de zéro. Une première phase initiale existe déjà. La priorité actuelle est de consolider l'existant, améliorer l'expérience utilisateur, renforcer le design premium et éviter tout rendu générique ou "IA".

L'objectif est de transformer l'interface existante en une V1 sérieuse, propre, premium et commercialisable.

**Fondateur :** Timéo Marcopoulos

---

## 1. Priorité actuelle du projet

La priorité actuelle n'est pas d'ajouter un maximum de fonctionnalités.

La priorité est de :

- améliorer le design existant ;
- rendre l'interface plus premium ;
- éviter le rendu générique généré par IA ;
- clarifier les parcours utilisateur ;
- améliorer la hiérarchie visuelle ;
- renforcer la cohérence graphique ;
- améliorer les espacements, alignements, états vides, feedbacks et microcopy ;
- rendre le dashboard plus rassurant et professionnel ;
- conserver les fonctionnalités existantes ;
- ne pas casser la logique métier déjà présente.

Ne pas considérer que le projet commence de zéro.

Avant toute modification importante, inspecter l'existant et proposer des améliorations ciblées.

---

## 2. Positionnement produit

FalconDraft n'est pas une simple automatisation n8n.

FalconDraft est un système personnalisé d'automatisation commerciale qui permet aux entreprises de :

- gagner du temps sur la création de propositions commerciales ;
- standardiser leurs documents commerciaux ;
- améliorer leur réactivité commerciale ;
- produire des documents professionnels ;
- préparer des brouillons Gmail prêts à relire et envoyer ;
- centraliser leurs dossiers commerciaux dans une interface claire.

Le client ne doit pas voir la complexité technique.

Ne jamais exposer dans l'interface client : n8n, Gamma, Invoice Ninja, Gotenberg, DocuSeal, webhooks, APIs internes, IDs techniques inutiles, logs bruts.

Expérience client cible :

Je crée un dossier commercial → je renseigne les informations nécessaires → je lance une génération → je valide le résultat → j'obtiens ma proposition, mon devis, mon lien de signature et mon brouillon Gmail.

---

## 3. Stack technique

- Next.js + TypeScript + Tailwind CSS + shadcn/ui + @radix-ui + Framer Motion (12.38.0)
- Supabase (Auth + DB + RLS multi-tenant) + Drizzle ORM
- n8n + Gamma + Gmail API / OAuth Google + Resend
- Stripe Billing + Gotenberg + DocuSeal
- PostHog + Sentry + Better Stack + Cloudflare + Vercel
- Font : Geist (next/font/google)

---

## 4. Règles d'architecture

### Source de vérité

FalconDraft App est la source de vérité pour : utilisateurs, organisations, workspaces, rôles, permissions, dossiers commerciaux, documents, statuts, connexions Gmail, configurations workflow, facturation, accès client.

n8n orchestre les automatisations, mais ne doit pas être la source de vérité pour les permissions ou l'identité utilisateur.

### Multi-client

Chaque client appartient à une organisation Supabase. Toutes les données client sensibles doivent être rattachées à un organization_id. Chaque utilisateur ne doit voir que les données de son organisation.

La sécurité multi-client repose sur : organization_id, Supabase Auth, Supabase RLS, vérifications serveur, politiques d'accès strictes.

Ne jamais se contenter d'un filtrage frontend pour protéger des données client.

---

## 5. Supabase et RLS

Supabase RLS est obligatoire sur toutes les tables sensibles : organizations, organization_members, organization_invitations, deals, proposals, documents, workflow_configs, workflow_runs, email_connections, generated_outputs, billing tables, audit logs.

Avant de créer ou modifier une table contenant des données client :
1. vérifier la présence d'un organization_id si pertinent ;
2. définir les politiques RLS ;
3. vérifier les accès par rôle ;
4. tester qu'un utilisateur d'une organisation ne peut pas accéder aux données d'une autre.

Ne jamais désactiver RLS pour contourner un bug sans expliquer les risques.

---

## 6. Organisations et rôles

Rôles côté client : manager (Gestionnaire), member (Collaborateur), viewer (Lecteur).

Le rôle owner est réservé à la logique interne FalconDraft. Ne jamais afficher owner au client. L'admin interne FalconDraft ne doit jamais être visible pour les clients classiques.

---

## 7. Workflows n8n

Chaque client peut avoir : son webhook n8n, ses prompts, son template Gamma, ses règles commerciales, son style de proposition, ses paramètres spécifiques.

La table workflow_configs relie une organisation à ses workflows :

```
workflow_configs : id, organization_id, workflow_type, n8n_webhook_url, n8n_workflow_id, status, created_at, updated_at
```

Types de workflows : call_summary, proposal_generation, proposal_validation, final_document_generation, email_draft_generation.

Ne jamais hardcoder les URLs de webhooks n8n directement dans le code.

---

## 8. Gmail et OAuth

FalconDraft crée des brouillons Gmail, pas d'envoi automatique. Le commercial garde toujours la main finale.

Règles : ne jamais demander/stocker le mot de passe Gmail, utiliser OAuth Google, demander uniquement les scopes nécessaires, ne pas lire la boîte mail si inutile, ne jamais logger les tokens OAuth, chiffrer les tokens sensibles.

Resend = emails système FalconDraft. Gmail API = brouillons commerciaux client.

---

## 9. Règle importante sur les dossiers commerciaux

Le champ name/intitulé du dossier est uniquement un repère interne. Ne jamais l'utiliser dans une proposition, email, devis ou document final.

Utiliser plutôt : client_company_name, client_contact_name, client_email, transcript, call_summary, proposal_content, amount_estimate, documents, company_context.

Ajouter dans les prompts sensibles : "Important : n'utilise jamais l'intitulé interne du dossier commercial comme nom officiel du projet client."

---

## 10. Design system — Tokens CSS

Tous les tokens sont définis dans `:root` de `app/globals.css` :

```css
--background: #FAFAF8;
--background-subtle: #F5F4F0;
--background-card: #FFFFFF;
--sidebar-bg: #0F1623;
--sidebar-hover: #1C2535;
--sidebar-active: #1E2D45;
--sidebar-border: #1E2738;
--sidebar-text: #94A3B8;
--sidebar-text-active: #FFFFFF;
--primary: #1a2744;
--primary-hover: #223260;
--primary-foreground: #FFFFFF;
--accent: #B8922A;
--accent-soft: #FDF7E8;
--accent-foreground: #7A5E10;
--border: #E8E6E0;
--border-strong: #D4D0C8;
--foreground: #1C1917;
--muted-foreground: #78716C;
--muted: #F5F4F0;
--success: #15803D;
--success-soft: #F0FDF4;
--warning: #B45309;
--warning-soft: #FFFBEB;
--destructive: #B91C1C;
--destructive-soft: #FEF2F2;
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.04);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.06), 0 4px 6px -4px rgb(0 0 0 / 0.04);
--radius: 0.5rem;
--radius-sm: 0.375rem;
--radius-lg: 0.75rem;
```

Toujours utiliser les tokens CSS `var(--...)` — jamais de couleurs hardcodées.

---

## 11. Direction design et règles visuelles

L'interface doit être : premium, sobre, claire, élégante, rassurante, professionnelle, moderne sans être tape-à-l'œil, dense mais lisible, orientée productivité B2B.

Éviter absolument : design générique "IA", gradients violets, cartes trop nombreuses sans hiérarchie, ombres excessives, animations inutiles, interfaces trop vides, dashboards template SaaS basique, textes placeholders vagues, icônes décoratives sans rôle.

### Typographie — Polices validées
- Titres (Display, Heading) : Fraunces — variable, optical size auto
- Corps (Body, Small, Label) : Instrument Sans
- Importer via next/font/google
- Ne jamais utiliser Geist ou Inter

### Typographie
- Display : 32px / 600 / letter-spacing -1%
- Heading : 24px / 600
- Body : 14px / 400 / line-height 1.6
- Small : 13px / 400
- Label : 11px / 500 / uppercase / letter-spacing 0.05em
- Micro : 10px / 500 / uppercase / letter-spacing 0.08em

### Cards
- Fond : `var(--background-card)` + border `1px solid var(--border)` + shadow `var(--shadow-sm)` + radius `var(--radius-lg)`

### Boutons
- Primary : fond `var(--primary)` + texte white + radius 6px + hover `var(--primary-hover)`
- Ghost : fond transparent + border `var(--border)` + texte `var(--foreground)` + hover `var(--background-subtle)`
- Destructive : fond `var(--destructive-soft)` + texte `var(--destructive)`
- Transition 150ms ease sur tous les boutons

### Badges statut
- Fond `var(--accent-soft)` + texte `var(--accent-foreground)` + border `1px solid rgba(184,146,42,0.2)` + radius 4px + 11px uppercase

### Tables
- Header : 11px uppercase letter-spacing 0.06em `var(--muted-foreground)`
- Row hover : `var(--background-subtle)` transition 100ms
- Séparateurs : `var(--border)` 1px

### Skills design
- impeccable : audit, polish, design system, interface premium
- frontend-design : créer ou améliorer des composants frontend distinctifs
- Ne pas activer plusieurs skills design en même temps sans raison

---

## 12. Architecture navigation — Sidebar

### Comportement
- Sidebar fixe 220px — jamais rétractable
- Fond : `var(--sidebar-bg)` (#0F1623)
- Zone logo : fond BLANC (#FFFFFF) + border-bottom `var(--border)` + padding 16px
- Logo : `<img src="/falcondraft-logo_off.png">` height 36px object-contain — pas de filtre, pas de border-radius, pas de cercle
- WorkspaceContext : fond `var(--sidebar-hover)` + padding 12px 16px + border-bottom `var(--sidebar-border)`

### Items navigation
- Padding 8px 12px + border-radius 6px + gap 10px
- Inactif : texte `var(--sidebar-text)` 13px
- Actif : fond `var(--sidebar-active)` + border-left 2px `var(--accent)` + texte `var(--sidebar-text-active)` 500
- Hover : fond `var(--sidebar-hover)` + texte `var(--sidebar-text-active)` + transition 150ms
- Section INTERNE : 10px uppercase letter-spacing 0.08em `var(--sidebar-text)` + border-top `var(--sidebar-border)`
- Badge "Interne" : `rgba(184,146,42,0.12)` + texte `var(--accent)` + radius 4px + 10px

### Structure navigation complète
```typescript
const navItems = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Dossiers", href: "/dashboard/deals", icon: FolderOpen, submenu: [
    { label: "Mes dossiers", href: "/dashboard/deals?scope=mine" },
    { label: "Toute l'entreprise", href: "/dashboard/deals?scope=organization" },
    { label: "+ Nouveau dossier", href: "/dashboard/deals/new", highlight: true },
  ]},
  { label: "Documents", href: "/dashboard/documents", icon: FileText },
  { label: "Transcripts", href: "/dashboard/transcripts", icon: Mic, submenu: [
    { label: "Mes transcripts", href: "/dashboard/transcripts" },
    { label: "Récupérer un appel", href: "/dashboard/transcripts/recall" },
    { label: "+ Nouveau transcript", href: "/dashboard/transcripts/new", highlight: true },
  ]},
  { label: "Archives", href: "/dashboard/archives", icon: Archive },
  { label: "Paramètres", href: "/dashboard/settings", icon: Settings, submenu: [
    { label: "Général", href: "/dashboard/settings" },
    { label: "Équipe", href: "/dashboard/settings/team" },
    { label: "Intégrations", href: "/dashboard/settings/integrations" },
    { label: "Facturation", href: "/dashboard/settings/billing", adminOnly: true },
  ]},
]
```

### Sous-menu hover
- Déclenchement : `onMouseEnter` sur l'item parent
- Position : panneau fixe, left 220px, top aligné sur l'item, width 200px
- Fond : #FFFFFF + border `var(--border)` + `var(--shadow-lg)` + border-radius 8px
- Animation Framer Motion : `initial={{ opacity: 0, x: -8 }}` `animate={{ opacity: 1, x: 0 }}` `exit={{ opacity: 0, x: -8 }}` `transition={{ duration: 0.15, ease: "easeOut" }}`
- Fermeture : `onMouseLeave` sur le groupe sidebar + sous-menu
- Items : 13px `var(--foreground)` + padding 8px 12px + hover `var(--background-subtle)` + radius 6px
- Item highlight (+ Nouveau) : texte `var(--accent)` + weight 500
- Item actif : `var(--accent-soft)` + `var(--accent-foreground)` + 500
- `adminOnly: true` → masqué si `!canManageWorkspace`
- `<AnimatePresence>` pour gérer entrée/sortie

### Mini-refactor deals page requis
Dans `app/dashboard/deals/page.tsx`, lire le query param `?scope=` :
```typescript
const searchParams = useSearchParams()
const scope = searchParams.get('scope') ?? 'mine'
// Passe scope comme defaultValue au composant Tabs
```

---

## 13. Copywriting — Ton et textes validés

**Ton :** entre sobre/pro et chaleureux/direct. Phrases courtes, actives, utiles. Pas de jargon.

**Dashboard :** "Bonjour, [prénom]" / "Voici où en sont vos dossiers." / Stats : "En cours" / "Prêts à envoyer" / "Valeur estimée" / "Nécessitent votre attention" / Section récents : "À traiter en priorité" / Panel suivi : "Suivez la progression"

**Pipeline dossiers :** "Vos dossiers" / "Retrouvez et gérez toutes vos propositions." / Bouton : "+ Nouveau dossier" / Placeholder : "Rechercher..."

**Dossier détail :** Eyebrow "DOSSIER" / "Notes & transcription" / "Votre base de travail pour ce dossier." / "Documents générés" / "Tous les documents liés à ce dossier."

**Progression workflow :** Deal → "Cadrage client" / Compte-rendu → "Synthèse de l'appel" / Proposition → "Document prêt à envoyer" / Validation → "Vérification interne" / Document final → "PDF finalisé" / Signature → "Lien de signature" / Email d'envoi → "Brouillon personnalisable"

**Transcripts :** "Vos appels" / "Importez ou enregistrez vos appels clients." / "Coller un transcript" / "Importer un audio" / "Connecter un outil"

**Paramètres :** "Paramètres" / "Personnalisez votre espace FalconDraft." / "Accès & permissions"

**Erreurs (jamais de message technique brut) :**
- Mauvais : `Webhook 500: Cannot read property data of undefined`
- Bon : `La génération n'a pas pu être finalisée. Veuillez réessayer ou contacter le support.`

---

## 14. Breadcrumb

- Dashboard, liste Dossiers, liste Transcripts, Paramètres → aucun breadcrumb
- Page dossier détail → `Dossiers / [nom du dossier]`
- Page transcript détail → `Vos appels / [titre]`
- Style : 12px / `var(--muted-foreground)` / séparateur `/`

---

## 15. Performances

- `app/dashboard/loading.tsx` existe — skeleton animate-pulse affiché à chaque navigation
- Requêtes Supabase parallélisées avec `Promise.all` dans `app/dashboard/deals/[id]/page.tsx`
- `cache()` de React déjà appliqué sur `loadCurrentUserContext` dans `lib/auth/session.ts`
- Tous les liens utilisent `<Link>` Next.js — pas de `<a href>`

---

## 16. Plan de refonte design — État d'avancement

### ✅ Fait
- Tokens design system (globals.css)
- Sidebar sombre premium
- Logo : zone fond blanc, `falcondraft-logo_off.png` height 36px, pas de filtre
- Dashboard : cards, table, panel progression
- Copywriting complet (i18n FR/EN/ES dans `lib/i18n/translations.ts`)
- Breadcrumb contextuel (`components/common/page-breadcrumb.tsx`)
- Page dossier détail + panel Actions (boutons ghost premium)
- loading.tsx + performances (Promise.all)

### 🔄 En cours
- Sidebar fixe 220px + sous-menu hover (Dossiers, Transcripts, Paramètres)
- Mini-refactor deals page (`?scope=` query param)

### 📋 À faire dans l'ordre
1. Sidebar fixe + sous-menus hover (en cours)
2. Typographie — explorer options premium (polices trop standards)
3. Page dossier — organisation à revoir, trop "IA généré"
4. Page Paramètres — refonte style
5. Animations Framer Motion — transitions entre pages, micro-interactions
6. Claude Design — tester une direction visuelle alternative

---

## 17. Statuts

Générations : draft, pending, processing, generated, validated, failed, cancelled

Workflows : queued, running, success, failed, retrying, cancelled

Facturation : active, trial, past_due, cancelled, suspended

Documents rattachés à : organization_id, deal_id, created_by, document_type, status, file_url, created_at

Types documents : call_summary, proposal, quote, final_pdf, signature_link, email_draft

---

## 18. Monitoring et analytics

**Sentry :** erreurs frontend, backend, API, OAuth, Supabase, workflow, serveur.

**PostHog :** événements produit uniquement. Ne jamais envoyer contenu des appels, emails complets, propositions, devis, tokens, données sensibles client.

**Better Stack :** monitoring uptime — app FalconDraft, API, n8n, Gotenberg, DocuSeal, webhooks critiques.

---

## 19. Sécurité

- Ne jamais exposer de secrets côté client
- Ne jamais commit .env
- Ne jamais logger les tokens OAuth
- Chiffrer les tokens sensibles
- Valider les permissions côté serveur
- Utiliser RLS côté base
- Protéger les endpoints sensibles
- Utiliser le skill owasp-security pour : Auth, RLS, OAuth, webhooks, API routes, permissions, Stripe, données client sensibles

Fichiers/variables à ne jamais exposer : .env, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY, N8N secrets, STRIPE_SECRET_KEY, RESEND_API_KEY, POSTHOG secrets, SENTRY auth token.

---

## 20. Debug

Utiliser le skill systematic-debugging pour : erreurs de build, bugs non compris, problèmes Supabase, erreurs RLS, erreurs OAuth, bugs n8n/backend, erreurs Vercel, problèmes TypeScript, comportements inattendus.

Ne pas corriger au hasard. Toujours chercher la cause racine avant de modifier.

---

## 21. Conventions de développement

Avant de modifier du code :
1. lire uniquement les fichiers nécessaires ;
2. comprendre la structure existante ;
3. proposer un plan court si la tâche est importante ;
4. modifier seulement les fichiers concernés ;
5. éviter les refactors globaux non demandés ;
6. ne pas changer le design global sans demande ;
7. ne pas modifier la base de données sans expliquer ;
8. ne pas modifier les règles RLS sans prudence ;
9. ne pas modifier les flows d'auth sans expliquer ;
10. typecheck clean obligatoire après chaque modification.

---

## 22. Commandes utiles

```bash
npm install
npm run dev
npm run lint
npm run build
npm run typecheck
git status
git diff
```

---

## 23. Règles absolues pour Claude Code

- Lire ce fichier avant de travailler
- Ne pas lire tout le repo inutilement
- Ne pas modifier des fichiers non concernés
- Ne pas faire de refactor global sans demande explicite
- Ne pas supprimer des fonctionnalités existantes sans validation
- Ne pas hardcoder de secrets, webhooks client ou données client
- Ne pas inventer une architecture différente si celle-ci est déjà définie
- Toujours utiliser `var(--...)` — jamais de couleurs hardcodées
- Toujours préserver la sécurité multi-client et l'isolation par organisation
- Toujours garder FalconDraft App comme source de vérité
- Toujours garder n8n comme moteur d'orchestration, pas comme source de permissions
- Mobile Sheet toujours inchangée
- SSR safe — pas de localStorage direct, toujours dans `useEffect`
- `<AnimatePresence>` pour toutes les animations d'entrée/sortie
- Charger les skills `impeccable` + `frontend-design` pour les tâches UI complexes

---

## 24. Pour chaque tâche demandée

1. identifier les fichiers probablement concernés ;
2. lire uniquement ces fichiers ;
3. proposer un plan court si nécessaire ;
4. appliquer les changements ;
5. lister les fichiers modifiés ;
6. expliquer brièvement ce qui a été fait ;
7. donner les commandes à lancer pour vérifier.

---

## 25. Rappel final

FalconDraft App doit donner une impression de produit sérieux, premium et maîtrisé.

Le client doit sentir : système clair, gain de temps, documents propres, expérience premium, sécurité, accompagnement, fiabilité, produit maîtrisé.

Il ne doit jamais sentir : outil bricolé, automatisation fragile, n8n visible, stack technique exposée, process compliqué, design générique IA, template SaaS sans âme.
