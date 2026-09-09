import "server-only";

import sanitizeHtml from "sanitize-html";

/**
 * Assainit le HTML d'un email avant affichage.
 *
 * Un email est du contenu envoyé par un inconnu : le rendre tel quel dans
 * l'application reviendrait à exécuter le code de l'expéditeur dans la session
 * du courtier. Deux menaces, deux réponses :
 *
 *   1. Script et gestionnaires d'événements → supprimés (liste blanche stricte
 *      de balises et d'attributs, aucun `on*`, aucune URL `javascript:`).
 *   2. Cadres et objets embarqués → supprimés.
 *
 * Le résultat est ensuite rendu dans une iframe `sandbox`, qui bloque à nouveau
 * script, formulaires et navigation : deux barrières valent mieux qu'une.
 *
 * Les images distantes, elles, se chargent normalement — comme dans n'importe
 * quel logiciel de messagerie. Un email illisible parce que sa mise en page est
 * amputée coûte plus au courtier que ne lui rapporte le fait de masquer
 * l'accusé de lecture à un expéditeur.
 */

export type SanitizedEmail = {
  html: string;
};

export function sanitizeEmailHtml(raw: string): SanitizedEmail {
  const clean = sanitizeHtml(raw, {
    allowedTags: [
      "p", "br", "div", "span", "strong", "b", "em", "i", "u", "s",
      "ul", "ol", "li", "blockquote", "pre", "code",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "table", "thead", "tbody", "tfoot", "tr", "td", "th",
      "a", "img", "hr", "small", "sub", "sup", "figure", "figcaption",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      "*": ["style", "align", "colspan", "rowspan"],
    },
    // `style` reste autorisé mais borné : une mise en forme d'email tient dans
    // ces propriétés, et on évite `position`/`z-index` qui permettraient de
    // recouvrir l'interface.
    allowedStyles: {
      "*": {
        color: [/^.*$/],
        "background-color": [/^.*$/],
        "text-align": [/^left$|^right$|^center$|^justify$/],
        "font-weight": [/^.*$/],
        "font-style": [/^.*$/],
        "font-size": [/^\d+(\.\d+)?(px|em|rem|pt|%)$/],
        "text-decoration": [/^.*$/],
        padding: [/^[\d\s.]+(px|em|rem|%)?$/],
        margin: [/^[\d\s.]+(px|em|rem|%)?$/],
        border: [/^.*$/],
        width: [/^\d+(\.\d+)?(px|em|rem|%)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      // `cid:` désigne une image incluse dans le message ; on ne sait pas la
      // résoudre ici, elle sera simplement absente plutôt que cassée.
      img: ["http", "https", "data", "cid"],
    },
    // Rien ne doit pouvoir naviguer la fenêtre de l'application.
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      }),
    },
    // Les commentaires conditionnels d'Outlook contiennent du balisage entier :
    // on ne les garde pas.
    allowedIframeHostnames: [],
    disallowedTagsMode: "discard",
  });

  return { html: clean };
}
