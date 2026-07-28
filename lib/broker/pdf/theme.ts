import { StyleSheet } from "@react-pdf/renderer";
import { SIGNATURE_BOX } from "./signature-area";

/**
 * Design tokens for the generated legal PDFs (devoir de conseil, entrée en
 * relation, fiche d'information). Mirrors the app palette. We rely on the
 * built-in PDF fonts (Helvetica / Times) for V1 — brand fonts (Fraunces /
 * Instrument Sans) are a later polish pass (requires bundling static TTFs).
 */
export const PDF = {
  navy: "#1a2744",
  navySoft: "#33415C",
  ink: "#1C1917",
  muted: "#6B6661",
  faint: "#9A958D",
  gold: "#B8922A",
  border: "#D7D3CB",
  borderSoft: "#EAE7E0",
  bgSubtle: "#F6F5F2",
  white: "#FFFFFF",
} as const;

export const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 64,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    lineHeight: 1.4,
    color: PDF.ink,
  },

  // --- Header (en-tête) ---
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1.5,
    borderBottomColor: PDF.navy,
    paddingBottom: 10,
    marginBottom: 4,
  },
  logo: { height: 38, objectFit: "contain" },
  headerRight: { textAlign: "right", maxWidth: 250 },
  headerName: {
    fontFamily: "Times-Bold",
    fontSize: 12.5,
    color: PDF.navy,
  },
  headerMeta: { fontSize: 7.5, color: PDF.muted, lineHeight: 1.4 },
  goldRule: { height: 2, backgroundColor: PDF.gold, width: 46, marginTop: 6 },

  // --- Document title ---
  docKicker: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 1.4,
    color: PDF.gold,
    textTransform: "uppercase",
    marginTop: 18,
  },
  docTitle: {
    fontFamily: "Times-Bold",
    fontSize: 19,
    color: PDF.navy,
    marginTop: 4,
    marginBottom: 2,
  },
  docSubtitle: {
    fontSize: 8.5,
    color: PDF.muted,
    marginTop: 5,
    lineHeight: 1.4,
  },

  // --- Recitals / intro paragraphs ---
  recital: { fontSize: 8.5, color: PDF.muted, marginTop: 8, textAlign: "left" },
  introPara: {
    fontSize: 8.5,
    color: PDF.ink,
    marginTop: 6,
    textAlign: "left",
    lineHeight: 1.4,
  },

  // --- Sommaire ---
  toc: {
    marginTop: 18,
    backgroundColor: PDF.bgSubtle,
    borderWidth: 0.75,
    borderColor: PDF.borderSoft,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  tocLink: {
    flexDirection: "row",
    marginBottom: 3.5,
    textDecoration: "none",
  },
  tocNum: {
    width: 28,
    color: PDF.gold,
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    textDecoration: "none",
  },
  tocText: { fontSize: 9, color: PDF.navy, textDecoration: "none" },

  // --- Sections ---
  section: { marginTop: 22 },
  sectionTitle: {
    fontFamily: "Times-Bold",
    fontSize: 11.5,
    color: PDF.navy,
    paddingBottom: 5,
    borderBottomWidth: 0.75,
    borderBottomColor: PDF.borderSoft,
    marginBottom: 10,
  },
  subLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: PDF.navySoft,
    marginTop: 13,
    marginBottom: 5,
  },
  paragraph: { marginTop: 5, textAlign: "left", fontSize: 9, lineHeight: 1.4 },

  // --- Key/value rows ---
  kvRow: { flexDirection: "row", marginBottom: 3 },
  kvLabel: { width: 150, color: PDF.muted, fontSize: 9 },
  kvValue: { flex: 1, color: PDF.ink },
  kvValueMuted: { flex: 1, color: PDF.faint },

  // --- Bullets ---
  bulletRow: { flexDirection: "row", marginBottom: 3, paddingLeft: 2 },
  bulletDot: { width: 14, color: PDF.gold, fontFamily: "Helvetica-Bold" },
  bulletText: { flex: 1, textAlign: "left", lineHeight: 1.4 },

  // --- Callout card ---
  card: {
    backgroundColor: PDF.bgSubtle,
    borderWidth: 0.75,
    borderColor: PDF.borderSoft,
    borderRadius: 4,
    padding: 10,
    marginTop: 8,
  },
  label: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1,
    color: PDF.faint,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  acknowledgement: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: PDF.navy,
    marginTop: 16,
    textAlign: "left",
    lineHeight: 1.45,
  },

  // --- Signatures ---
  // --- Signature page ---
  // The box is absolutely positioned so its coordinates are known exactly:
  // lib/broker/pdf/signature-area.ts places the e-signature field on top of it.
  signatureLabel: {
    position: "absolute",
    left: SIGNATURE_BOX.left,
    bottom: SIGNATURE_BOX.bottom + SIGNATURE_BOX.height + 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: PDF.ink,
  },
  signatureBox: {
    position: "absolute",
    left: SIGNATURE_BOX.left,
    bottom: SIGNATURE_BOX.bottom,
    width: SIGNATURE_BOX.width,
    height: SIGNATURE_BOX.height,
    borderWidth: 0.75,
    borderColor: PDF.borderSoft,
    borderRadius: 2,
  },
  signatureCaption: {
    position: "absolute",
    left: SIGNATURE_BOX.left,
    bottom: SIGNATURE_BOX.bottom - 16,
    width: SIGNATURE_BOX.width,
    fontSize: 8,
    color: PDF.ink,
  },
  signatureHint: {
    position: "absolute",
    left: SIGNATURE_BOX.left,
    bottom: SIGNATURE_BOX.bottom - 28,
    width: SIGNATURE_BOX.width + 120,
    fontSize: 7.5,
    color: PDF.muted,
  },

  // --- Footer ---
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    borderTopWidth: 0.75,
    borderTopColor: PDF.borderSoft,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 6.8, color: PDF.faint },
  remittance: { fontSize: 8.5, color: PDF.muted, marginTop: 18 },

  // --- Fillable form lines ---
  formRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 5 },
  formLabel: { width: 190, color: PDF.muted, fontSize: 9 },
  formValue: { flex: 1, color: PDF.ink, fontSize: 9.5 },
  blankLine: {
    flex: 1,
    borderBottomWidth: 0.6,
    borderBottomColor: PDF.border,
    height: 11,
  },
  blankBox: {
    borderWidth: 0.6,
    borderColor: PDF.border,
    borderRadius: 3,
    height: 46,
    marginTop: 5,
  },

  // --- Product checklist ---
  checkGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 3 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "50%",
    marginBottom: 4,
    paddingRight: 12,
  },
  checkbox: {
    width: 8.5,
    height: 8.5,
    borderWidth: 1,
    borderColor: PDF.navy,
    borderRadius: 1.5,
    marginRight: 6,
  },
  checkboxOn: { backgroundColor: PDF.navy },
  checkLabel: { fontSize: 8.2, color: PDF.ink, flex: 1 },

  // --- Personalisation questions & clauses ---
  question: { fontSize: 8.6, color: PDF.ink, marginTop: 8 },
  clauseBox: {
    marginTop: 14,
    backgroundColor: PDF.bgSubtle,
    borderLeftWidth: 2,
    borderLeftColor: PDF.border,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  clauseBoxLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.8,
    letterSpacing: 0.8,
    color: PDF.faint,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  clauseBoxText: {
    fontSize: 8,
    color: PDF.muted,
    lineHeight: 1.4,
    textAlign: "left",
  },
  consent: {
    fontSize: 8,
    color: PDF.muted,
    marginTop: 12,
    textAlign: "left",
    lineHeight: 1.4,
  },
});
