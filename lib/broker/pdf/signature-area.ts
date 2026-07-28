/**
 * Geometry of the client signature box on the devoir de conseil.
 *
 * Single source of truth shared by two consumers that must agree to the point:
 * the PDF renderer, which draws the box, and the DocuSeal payload, which places
 * the signature field on top of it. Change the numbers here and both follow.
 *
 * We used to let DocuSeal locate the field from an invisible "{{…}}" text tag,
 * but the field then inherited the tag's text bounding box — a 6pt sliver under
 * the rule. Explicit coordinates give a real signing area.
 */

/** A4 in PostScript points, the unit react-pdf lays out in. */
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

/**
 * Box position, in points from the page edges — NOT from the content box.
 * react-pdf resolves absolute offsets against the page itself (the existing
 * footer relies on the same behaviour: `left: 48` aligns it with the 48pt
 * horizontal page padding).
 */
export const SIGNATURE_BOX = {
  left: 48,
  bottom: 150,
  width: 260,
  height: 64,
} as const;

export type SignatureFieldArea = {
  x: number;
  y: number;
  w: number;
  h: number;
  page: number;
};

/**
 * The box expressed the way DocuSeal wants it: fractions of the page, origin at
 * the top-left, `page` 1-indexed. (Verified against the API — the docs show
 * pixel-looking values in one example, but stored areas are normalised.)
 */
export function signatureFieldArea(page: number): SignatureFieldArea {
  return {
    x: SIGNATURE_BOX.left / A4_WIDTH,
    y: (A4_HEIGHT - SIGNATURE_BOX.bottom - SIGNATURE_BOX.height) / A4_HEIGHT,
    w: SIGNATURE_BOX.width / A4_WIDTH,
    h: SIGNATURE_BOX.height / A4_HEIGHT,
    page,
  };
}

/**
 * Number of pages in a react-pdf buffer.
 *
 * The signature box is forced onto its own final page, so the field's page
 * number is simply the page count. react-pdf writes an uncompressed page tree,
 * so the `/Type /Pages … /Count n` node is readable; counting `/Type /Page`
 * objects is the fallback. Returns 1 when neither is found — a wrong page is
 * still better than no signature field at all.
 */
export function countPdfPages(pdf: Buffer): number {
  const raw = pdf.toString("latin1");

  // The page-tree node, whichever order the two keys appear in.
  const tree =
    /\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/.exec(raw) ??
    /\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/.exec(raw);
  if (tree) {
    const count = Number(tree[1]);
    if (Number.isInteger(count) && count > 0) return count;
  }

  // Fallback: count leaf page objects ("/Page" not followed by "s").
  const leaves = raw.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return leaves && leaves.length > 0 ? leaves.length : 1;
}
