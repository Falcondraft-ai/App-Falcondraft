import "server-only";

import sanitizeHtml from "sanitize-html";

/**
 * Assainit le HTML d'un email avant affichage.
 *
 * Un email est du contenu envoyé par un inconnu : le rendre tel quel dans
 * l'application reviendrait à exécuter le code de l'expéditeur dans la session
 * du courtier. Trois menaces, trois réponses :
 *
 *   1. Script et gestionnaires d'événements → supprimés (liste blanche stricte
 *      de balises et d'attributs, aucun `on*`, aucune URL `javascript:`).
 *   2. Pixels de suivi et images distantes → neutralisés par défaut. Ouvrir un
 *      email ne doit pas signaler à l'expéditeur qu'il a été lu. Le courtier
 *      les affiche d'un clic quand il le décide.
 *   3. Cadres et objets embarqués → supprimés.
 *
 * Le résultat est ensuite rendu dans une iframe `sandbox`, qui bloque à nouveau
 * script, formulaires et navigation : deux barrières valent mieux qu'une.
 */

/** Attribut où l'on met de côté la source d'une image bloquée. */
const DEFERRED_SRC = "data-blocked-src";

export type SanitizedEmail = {
  html: string;
  /** Nombre d'images distantes neutralisées, pour proposer de les afficher. */
  blockedImages: number;
};

export function sanitizeEmailHtml(
  raw: string,
  options?: { allowRemoteImages?: boolean },
): SanitizedEmail {
  let blockedImages = 0;

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
      img: ["src", "alt", "title", "width", "height", DEFERRED_SRC],
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
      img: (tagName, attribs) => {
        const src = attribs.src ?? "";
        const remote = /^https?:/i.test(src);
        if (remote && !options?.allowRemoteImages) {
          blockedImages += 1;
          // La source part dans un attribut inerte : l'image ne se charge pas,
          // mais on garde la trace pour pouvoir la rétablir sur demande.
          const rest = { ...attribs };
          delete rest.src;
          return { tagName, attribs: { ...rest, [DEFERRED_SRC]: src } };
        }
        return { tagName, attribs };
      },
    },
    // Les commentaires conditionnels d'Outlook contiennent du balisage entier :
    // on ne les garde pas.
    allowedIframeHostnames: [],
    disallowedTagsMode: "discard",
  });

  return { html: clean, blockedImages };
}
