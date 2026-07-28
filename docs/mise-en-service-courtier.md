# Mise en service — Courtier sur mesure

Checklist interne FalconDraft pour ouvrir un espace courtier. Rédigée pour la
livraison AssurConseil ; réutilisable pour tout cabinet en offre sur mesure,
**sauf les annexes légales** (voir l'avertissement en fin de document).

À faire dans l'ordre : chaque étape suppose la précédente.

---

## 1. Déployer le code

Deux commits sur `feat/signature-electronique` :

| Commit | Contenu |
|---|---|
| `b6617bf` | Signature électronique DocuSeal de bout en bout |
| `06a2e91` | Import de contrats par IA, aperçu des pièces jointes, correctif emails en double |

```bash
git checkout main
git merge feat/signature-electronique
git push origin main
```

Vérifier que le déploiement Vercel passe au vert avant de continuer.

---

## 2. Variables d'environnement (Vercel → Settings → Environment Variables)

```
DOCUSEAL_API_KEY=<clé du compte DocuSeal Pro>
DOCUSEAL_BASE_URL=https://api.docuseal.eu
DOCUSEAL_WEBHOOK_SECRET=<secret partagé, identique à l'étape 3>
DOCUSEAL_SIGNATURE_EXPIRY_DAYS=30
CRON_SECRET=<secret des tâches planifiées>
```

Points de vigilance :

- **La région compte.** Une clé créée sur le compte européen ne fonctionne pas
  sur `api.docuseal.com` (401). Le lien de signature de repli est dérivé de
  cette variable, une mauvaise région produit des liens morts.
- **`CRON_SECRET` conditionne trois tâches** : briefing Outlook quotidien,
  nettoyage des fichiers du copilote, relances de signature. Sans lui, les trois
  routes répondent 503 et rien ne tourne — en silence.
- Ne jamais coller une clé dans un ticket, un chat ou un commit. Si c'est
  arrivé, la révoquer depuis la console DocuSeal et en générer une autre.

---

## 3. Webhook DocuSeal

Console DocuSeal (région EU) → Settings → Webhooks.

- **URL** : `https://app.falcondraft.fr/api/broker/webhooks/docuseal`
- **Secret** : header `X-Docuseal-Secret` = la valeur de `DOCUSEAL_WEBHOOK_SECRET`
  (à défaut, `…/docuseal?token=<secret>` si l'interface ne permet que l'URL)
- **Événements** : `form.viewed`, `form.completed`, `form.declined`

Sans ce webhook, rien n'est cassé : le statut se met à jour au chargement de la
page et via le bouton « Actualiser ». Mais le courtier ne voit plus les
signatures arriver en temps réel.

---

## 4. Créer l'organisation

Console d'administration interne :

- **Type d'espace** : courtier en assurance
- **Offre** : `custom` (sur mesure)
- Quota de stockage selon le contrat

L'offre `custom` donne accès à la gestion complète — dossiers, contrats,
sinistres, commissions, devoir de conseil, GED, conformité, briefing Outlook,
copilote IA et **signature électronique**. Elle exclut le module Propositions
commerciales, réservé au SaaS.

---

## 5. Paramétrer le cabinet

Dans `/courtier/settings/conformite`, renseigner les informations légales :
identité du cabinet, immatriculation ORIAS, rémunération, responsabilité civile
professionnelle, autorité de contrôle, service réclamation et médiateur.

**Ce n'est pas optionnel.** Ces champs alimentent les mentions obligatoires du
devoir de conseil. Un champ vide est omis du PDF plutôt que remplacé par un
« [à compléter] » : le document sort silencieusement incomplet.

Le cabinet peut le faire lui-même, mais mieux vaut le remplir avec lui pendant
la session de démarrage.

---

## 6. Connecter Outlook

`/courtier/settings/integrations` — connexion OAuth Microsoft, par utilisateur.

Sans Outlook connecté : pas de briefing quotidien, et le bouton « Préparer le
brouillon » du devoir de conseil reste désactivé.

---

## 7. Inviter les utilisateurs

`/courtier/settings/equipe`. Rôles : Gestionnaire, Collaborateur, Lecteur.

---

## 8. Recette avant de rendre la main

Dérouler un dossier complet sur un client de test :

1. Créer un dossier client avec une adresse email valide.
2. Générer un devoir de conseil, relire, valider.
3. Générer le PDF, vérifier que les mentions du cabinet apparaissent bien.
4. Préparer la signature, copier le lien.
5. Ouvrir le lien dans une fenêtre privée et signer.
6. Vérifier sur la page dossier : la frise passe à « Signée », le document signé
   et la preuve de signature apparaissent dans les pièces du dossier.
7. Supprimer le dossier de test.

Ne pas ouvrir le lien de signature depuis sa propre session : il est nominatif,
son ouverture serait enregistrée comme celle du client.

---

## Avertissement — annexes légales et logo

`lib/broker/legal-annexes.ts` joint à chaque email du devoir de conseil deux
fichiers **statiques et globaux**, lus dans `public/brand/` :

- `entree-en-relation.pdf`
- `mentions-obligatoires.pdf`

Ils ne sont **pas rattachés à une organisation**. Idem pour le logo : la
fonction `loadCabinetLogo` ne lit que des chemins sous `public/`, donc le logo
d'un cabinet doit être présent dans le dépôt.

Aujourd'hui ces fichiers sont ceux d'AssurConseil. **Le jour où un second
cabinet est ouvert, ses clients recevront les documents légaux d'AssurConseil.**

Ce n'est pas un détail : ce sont des documents réglementaires nominatifs, et
c'est une fuite d'informations d'un cabinet vers les clients d'un autre. Avant
d'ouvrir un deuxième cabinet, il faut stocker un jeu d'annexes et un logo par
organisation.
