# Brief — Page Tarifs « FalconDraft Courtier SaaS »

> À utiliser pour créer la page tarifs sur le **site marketing** (géré séparément).
> Les offres ci-dessous sont la source de vérité (validées 2026-06-27).

## Les 3 offres — par cabinet, HT/mois

Essai **14 jours** · **annuel = 2 mois offerts** · facturation **par cabinet** (pas par utilisateur).

| | Essentiel | Cabinet ★ (recommandé) | Performance |
|---|---|---|---|
| Prix | **39 €/mois** | **89 €/mois** | **179 €/mois** |
| Sièges inclus | 2 | 5 | 10 |
| Stockage (GED) | 10 Go | 50 Go | 250 Go |
| CRM clients · contrats & renouvellements · sinistres | ✅ | ✅ | ✅ |
| Conformité LCB-FT / RGPD · devoir de conseil | ✅ | ✅ | ✅ |
| **Briefing Outlook IA** (création auto des dossiers depuis les mails) | ✅ | ✅ | ✅ |
| Commissions & rapprochement · **pointage IA des commissions** | — | ✅ | ✅ |
| Signature électronique | — | ✅ | ✅ |
| **Copilote IA agentique** | — | ✅ | ✅ |
| **Module Propositions commerciales** (devis → signature → email) | — | — | ✅ |
| Support | Email | Prioritaire | Onboarding dédié |

**Argument différenciant clé** : prix **par cabinet**, pas par utilisateur. *« À 5 personnes, un concurrent par siège ≈ 430 €/mois ; nous, 89 €/mois, IA incluse. »*

**Hook produit** : le Briefing Outlook IA est dans **toutes** les offres — c'est l'accroche.

## Intégration des boutons (IMPORTANT)

Chaque CTA « Commencer l'essai » / « Souscrire » doit pointer vers l'app, qui gère création de compte + cabinet + paiement Stripe :

```
https://<URL_APP>/inscription?offre=<essentiel|cabinet|performance>&cycle=<mensuel|annuel>
```

Bouton secondaire « Voir une démo » → `<lien de réservation>`.
*(À me confirmer : l'URL de l'app et l'URL de démo.)*

## Direction design

Premium, sobre, rassurant, B2B — **surtout pas** de gradient violet « IA générique ». Palette navy profond `#0F1623` / ivoire / accent doré `#B8922A`. Titres serif **Fraunces**, corps **Instrument Sans**. 3 cartes, l'offre **Cabinet** mise en avant (badge « Recommandé »). Tableau comparatif détaillé sous les cartes. FAQ. Mention discrète en bas : « TVA non applicable, art. 293 B du CGI ».

---

## Prompt prêt à coller (à donner à ton outil / designer)

```
Crée une page "Tarifs" web premium pour « FalconDraft Courtier », un SaaS de
gestion pour cabinets de courtage en assurance.

Trois offres mensuelles PAR CABINET (prix HT), essai 14 jours, annuel = 2 mois
offerts :

- Essentiel — 39 €/mois : 2 sièges, 10 Go, CRM clients, contrats &
  renouvellements, sinistres, conformité LCB-FT/RGPD, devoir de conseil,
  Briefing Outlook IA.
- Cabinet — 89 €/mois (RECOMMANDÉ) : 5 sièges, 50 Go, tout Essentiel +
  commissions & rapprochement de bordereaux, pointage IA des commissions,
  signature électronique, copilote IA agentique.
- Performance — 179 €/mois : 10 sièges, 250 Go, tout Cabinet + module
  Propositions commerciales (génération devis → signature → brouillon email),
  onboarding dédié.

Le « Briefing Outlook IA » (création automatique des dossiers clients à partir
de l'analyse des e-mails) est inclus dans TOUTES les offres — mets-le en avant,
c'est l'argument phare.

Argument de prix : facturation PAR CABINET, pas par utilisateur (les concurrents
facturent ~79 €/utilisateur ; montre l'économie pour une équipe de 5).

Style : premium, sobre, rassurant, orienté B2B assurance ; navy profond, ivoire,
accent doré ; titres en serif (Fraunces), corps en sans-serif (Instrument Sans) ;
3 cartes avec l'offre « Cabinet » mise en avant via un badge « Recommandé » ;
tableau comparatif détaillé des fonctionnalités sous les cartes ; section FAQ
(essai sans engagement, résiliation en 1 clic, données hébergées en UE / RGPD,
accompagnement à la migration) ; bandeau de réassurance (sécurité, support FR).
Pas de gradient violet ni d'esthétique « IA générique ».

Chaque bouton CTA pointe vers :
https://<URL_APP>/inscription?offre=<slug>&cycle=<mensuel|annuel>
(slug = essentiel | cabinet | performance). Ajoute un bouton secondaire
« Voir une démo ». Mentionne discrètement « TVA non applicable, art. 293 B du
CGI » en pied de page.
```
