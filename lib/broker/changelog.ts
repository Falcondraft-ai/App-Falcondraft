/**
 * « Quoi de neuf » du CRM courtier — affiché une fois par profil à la première
 * ouverture qui suit une mise à jour (components/broker/whats-new-dialog.tsx).
 *
 * Écrit pour le cabinet, pas pour nous : ce que le courtier peut FAIRE de plus,
 * dans ses mots, sans aucun détail technique. La première entrée est la plus
 * récente ; changer son `id` suffit à la présenter de nouveau à chacun.
 */
export type ChangelogKind = "new" | "improved" | "fixed";

export type ChangelogEntry = {
  id: string;
  date: string;
  title: string;
  items: { kind: ChangelogKind; title: string; description: string }[];
};

export const changelogKindLabels: Record<ChangelogKind, string> = {
  new: "Nouveau",
  improved: "Amélioré",
  fixed: "Corrigé",
};

export const courtierChangelog: ChangelogEntry[] = [
  {
    // « -2 » : une première version de cette note (avec l'import de fichiers
    // email, retiré depuis) a été en ligne quelques heures — ceux qui l'ont vue
    // doivent voir la version finale.
    id: "2026-09-28-2",
    date: "28 septembre 2026",
    title: "Vos demandes de la semaine sont en ligne",
    items: [
      {
        kind: "new",
        title: "Un devoir de conseil au nom de chaque société",
        description:
          "Chaque courtier émet désormais ses devoirs de conseil sous sa propre société : en-tête, logo, n° ORIAS et mentions légales en pied de chaque page. Vérifiez et complétez chaque fiche dans Paramètres → Mentions légales.",
      },
      {
        kind: "new",
        title: "Les bons documents joints à chaque envoi",
        description:
          "Le document d’entrée en relation et les mentions d’information joints à l’email du devoir de conseil sont propres à chaque société. Déposez-les une fois dans Paramètres → Mentions légales.",
      },
      {
        kind: "new",
        title: "Vos emails envoyés rangés dans les dossiers",
        description:
          "Ce que vous écrivez à un client apparaît automatiquement dans son dossier, à côté de ce qu’il vous envoie — y compris vos échanges des six derniers mois.",
      },
      {
        kind: "new",
        title: "Un onglet « Envoyés » dans Vos emails",
        description:
          "Vos emails affiche désormais vos messages reçus et vos messages envoyés, chacun dans son onglet.",
      },
      {
        kind: "new",
        title: "Rangez un email d’un glisser-déposer",
        description:
          "Dans Vos emails, faites glisser un message — reçu ou envoyé — sur le dossier du client : il y est rangé aussitôt. Le dossier du correspondant vous est proposé en premier.",
      },
      {
        kind: "improved",
        title: "Emails du dossier : Tous, Reçus, Envoyés",
        description:
          "Dans chaque dossier, affichez toute la conversation, seulement ce que le client vous a écrit, ou seulement ce que vous lui avez envoyé.",
      },
      {
        kind: "new",
        title: "Créer un client à partir d’un document",
        description:
          "Dans Importer des clients, déposez directement un PDF, une photo, un Word ou un Excel — plus besoin de le compresser en .zip. L’assistant lit la pièce et prépare le dossier. Accessible aussi depuis « Nouveau dossier ».",
      },
      {
        kind: "new",
        title: "Supprimer un document ou un contrat en un geste",
        description:
          "Une corbeille apparaît sur chaque ligne de la page Documents et des listes de contrats, avec une confirmation avant toute suppression.",
      },
      {
        kind: "fixed",
        title: "Devoir de conseil : plus aucun texte superposé",
        description:
          "Les devis aux garanties détaillées s’étalent désormais proprement sur plusieurs pages. Pensez à régénérer les devoirs de conseil déjà créés.",
      },
      {
        kind: "fixed",
        title: "Franchises reprises en entier",
        description:
          "Les franchises longues d’un devis ne sont plus coupées en cours de phrase.",
      },
      {
        kind: "improved",
        title: "Un CRM plus rapide",
        description:
          "Les pages s’ouvrent plus vite : l’application fonctionne désormais au plus près de vos données.",
      },
      {
        kind: "improved",
        title: "Le nom du cabinet toujours lisible",
        description:
          "La barre de recherche ne masque plus le nom du cabinet en haut de l’écran, quelle que soit la taille de la fenêtre.",
      },
    ],
  },
];
