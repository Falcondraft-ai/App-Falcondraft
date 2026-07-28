/**
 * Génère le guide de prise en main courtier en PDF.
 *
 *   npx tsx scripts/build-guide-pdf.tsx
 *
 * Reprend les tokens du moteur PDF de l'app (lib/broker/pdf/theme) pour que le
 * guide parle la même langue visuelle que le devoir de conseil que le cabinet
 * a déjà sous les yeux. Le contenu de référence vit dans
 * docs/guide-prise-en-main-courtier.md — les deux doivent évoluer ensemble.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import * as React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { PDF } from "../lib/broker/pdf/theme";

const OUT = "docs/FalconDraft-Guide-prise-en-main.pdf";
const LOGO = "public/brand/assurconseil-logo.png";

const s = StyleSheet.create({
  page: {
    paddingTop: 46,
    paddingBottom: 58,
    paddingHorizontal: 52,
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.5,
    color: PDF.ink,
  },

  // --- Couverture ---
  coverPage: { paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 },
  coverBand: {
    backgroundColor: PDF.navy,
    paddingTop: 54,
    paddingBottom: 44,
    paddingHorizontal: 52,
  },
  coverKicker: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 1.6,
    color: PDF.gold,
    textTransform: "uppercase",
  },
  coverTitle: {
    fontFamily: "Times-Bold",
    fontSize: 30,
    color: PDF.white,
    marginTop: 12,
    lineHeight: 1.15,
  },
  coverRule: {
    height: 2,
    width: 54,
    backgroundColor: PDF.gold,
    marginTop: 16,
  },
  coverFor: { fontSize: 9.5, color: "#B9C4D4", marginTop: 16 },
  coverBody: { paddingHorizontal: 52, paddingTop: 34 },
  coverLead: { fontSize: 10, lineHeight: 1.6, color: PDF.ink },
  coverLogo: { height: 34, objectFit: "contain", marginBottom: 26 },

  // --- Principe ---
  principle: {
    marginTop: 26,
    borderLeftWidth: 2.5,
    borderLeftColor: PDF.gold,
    backgroundColor: PDF.bgSubtle,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  principleTitle: {
    fontFamily: "Times-Bold",
    fontSize: 13,
    color: PDF.navy,
    marginBottom: 5,
  },
  principleText: { fontSize: 9, color: PDF.ink, lineHeight: 1.55 },

  // --- Sommaire ---
  tocWrap: { marginTop: 30 },
  tocLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1.4,
    color: PDF.muted,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  tocRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 0.75,
    borderTopColor: PDF.borderSoft,
    paddingVertical: 7,
  },
  tocNum: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: PDF.gold,
    width: 18,
  },
  tocText: { fontSize: 9.5, color: PDF.navy, flex: 1 },
  tocPage: { fontSize: 8.5, color: PDF.muted },

  // --- En-tête / pied courants ---
  runHeader: {
    position: "absolute",
    top: 22,
    left: 52,
    right: 52,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.75,
    borderBottomColor: PDF.borderSoft,
    paddingBottom: 6,
  },
  runHeaderText: {
    fontSize: 7,
    letterSpacing: 0.8,
    color: PDF.faint,
    textTransform: "uppercase",
  },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 52,
    right: 52,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: PDF.faint },

  // --- Sections ---
  section: { marginBottom: 20 },
  sectionHead: { flexDirection: "row", alignItems: "flex-start", marginBottom: 9 },
  sectionNum: {
    fontFamily: "Times-Bold",
    fontSize: 15,
    color: PDF.gold,
    width: 22,
    marginTop: -2,
  },
  sectionTitle: {
    fontFamily: "Times-Bold",
    fontSize: 14,
    color: PDF.navy,
    flex: 1,
  },
  sectionRule: {
    height: 0.75,
    backgroundColor: PDF.borderSoft,
    marginBottom: 11,
  },
  para: { fontSize: 9, lineHeight: 1.55, marginBottom: 8 },

  // --- Bloc réglage / carte ---
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  card: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: PDF.border,
    borderRadius: 3,
    padding: 12,
  },
  cardPath: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 0.5,
    color: PDF.gold,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    color: PDF.navy,
    marginBottom: 4,
  },
  cardText: { fontSize: 8.5, lineHeight: 1.5, color: PDF.ink },

  // --- Étapes numérotées ---
  step: { flexDirection: "row", marginBottom: 12 },
  stepBadge: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: PDF.navy,
    marginRight: 11,
    paddingTop: 4.5,
  },
  stepBadgeText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: PDF.white,
    textAlign: "center",
  },
  stepBody: { flex: 1 },
  stepTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: PDF.navy,
    marginBottom: 3,
  },
  stepText: { fontSize: 8.75, lineHeight: 1.55 },

  // --- Encadré d'avertissement ---
  callout: {
    borderLeftWidth: 2.5,
    borderLeftColor: PDF.gold,
    backgroundColor: PDF.bgSubtle,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: 14,
  },
  calloutTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.75,
    color: PDF.navy,
    marginBottom: 3,
  },
  calloutText: { fontSize: 8.5, lineHeight: 1.5, color: PDF.ink },

  // --- Listes ---
  bullet: { flexDirection: "row", marginBottom: 5 },
  bulletDot: { width: 11, fontSize: 9, color: PDF.gold },
  bulletText: { flex: 1, fontSize: 8.75, lineHeight: 1.5 },

  // --- Modules ---
  modRow: {
    flexDirection: "row",
    borderTopWidth: 0.75,
    borderTopColor: PDF.borderSoft,
    paddingVertical: 7,
  },
  modName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.75,
    color: PDF.navy,
    width: 92,
  },
  modText: { flex: 1, fontSize: 8.5, lineHeight: 1.5 },

  strong: { fontFamily: "Helvetica-Bold" },
  navy: { color: PDF.navy },
});

/* ------------------------------------------------------------------ */

function RunningChrome() {
  return (
    <>
      <View style={s.runHeader} fixed>
        <Text style={s.runHeaderText}>FalconDraft — Guide de prise en main</Text>
        <Text style={s.runHeaderText}>AssurConseil</Text>
      </View>
      <View style={s.footer} fixed>
        <Text style={s.footerText}>
          Une question ? Écrivez-nous, même pour un détail.
        </Text>
        <Text
          style={s.footerText}
          render={({ pageNumber }) => String(pageNumber)}
        />
      </View>
    </>
  );
}

function Section({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section} wrap={false}>
      <View style={s.sectionHead}>
        <Text style={s.sectionNum}>{num}</Text>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      <View style={s.sectionRule} />
      {children}
    </View>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.step}>
      <View style={s.stepBadge}>
        <Text style={s.stepBadgeText}>{n}</Text>
      </View>
      <View style={s.stepBody}>
        <Text style={s.stepTitle}>{title}</Text>
        <Text style={s.stepText}>{children}</Text>
      </View>
    </View>
  );
}

function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.callout} wrap={false}>
      <Text style={s.calloutTitle}>{title}</Text>
      <Text style={s.calloutText}>{children}</Text>
    </View>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.bullet}>
      <Text style={s.bulletDot}>—</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}

function Module({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <View style={s.modRow} wrap={false}>
      <Text style={s.modName}>{name}</Text>
      <Text style={s.modText}>{children}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */

function Guide({ logo }: { logo: Buffer | null }) {
  return (
    <Document
      title="FalconDraft — Guide de prise en main"
      author="FalconDraft"
      subject="Prise en main de l'espace courtier"
    >
      {/* ---------- Couverture ---------- */}
      <Page size="A4" style={[s.page, s.coverPage]}>
        <View style={s.coverBand}>
          <Text style={s.coverKicker}>FalconDraft · Espace courtier</Text>
          <Text style={s.coverTitle}>Guide de{"\n"}prise en main</Text>
          <View style={s.coverRule} />
          <Text style={s.coverFor}>Préparé pour AssurConseil</Text>
        </View>

        <View style={s.coverBody}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image react-pdf, pas une balise <img> : aucun attribut alt n'existe côté PDF */}
          {logo ? <Image style={s.coverLogo} src={logo} /> : null}

          <Text style={s.coverLead}>
            Vingt minutes pour l&apos;essentiel : le dossier client, le devoir de
            conseil, la signature électronique et l&apos;assistant Outlook.
            Gardez ce guide sous la main les premiers jours.
          </Text>

          <View style={s.principle}>
            <Text style={s.principleTitle}>Rien ne part sans vous</Text>
            <Text style={s.principleText}>
              FalconDraft prépare, vous relisez, vous envoyez. Aucun email
              n&apos;est expédié à votre place, aucun conseil n&apos;est validé
              sans vous. Le travail que l&apos;outil produit est une base sérieuse,
              mais le conseil délivré reste le vôtre.
            </Text>
          </View>

          <View style={s.tocWrap}>
            <Text style={s.tocLabel}>Au sommaire</Text>
            {[
              ["1", "Démarrer — deux réglages", "2"],
              ["2", "Le dossier client", "2"],
              ["3", "Le devoir de conseil", "3"],
              ["4", "L'assistant Outlook", "4"],
              ["5", "Le reste de votre espace", "4"],
            ].map(([n, label, page]) => (
              <View key={n} style={s.tocRow}>
                <Text style={s.tocNum}>{n}</Text>
                <Text style={s.tocText}>{label}</Text>
                <Text style={s.tocPage}>p. {page}</Text>
              </View>
            ))}
          </View>
        </View>
      </Page>

      {/* ---------- Page 2 ---------- */}
      <Page size="A4" style={s.page}>
        <RunningChrome />

        <Section num="1" title="Démarrer — deux réglages">
          <Text style={s.para}>
            À faire une fois, à la première connexion. Cinq minutes, et tout le
            reste en dépend.
          </Text>
          <View style={s.cardRow}>
            <View style={s.card}>
              <Text style={s.cardPath}>Paramètres → Conformité</Text>
              <Text style={s.cardTitle}>Les informations du cabinet</Text>
              <Text style={s.cardText}>
                Identité, numéro ORIAS, rémunération, responsabilité civile
                professionnelle, service réclamation et médiateur. Ces champs
                alimentent les mentions obligatoires de vos devoirs de conseil :
                un champ vide est simplement absent du document final. Remplissez
                tout en une fois.
              </Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardPath}>Paramètres → Intégrations</Text>
              <Text style={s.cardTitle}>Votre boîte Outlook</Text>
              <Text style={s.cardText}>
                Vous autorisez FalconDraft à lire votre boîte et à y déposer des
                brouillons. C&apos;est ce qui active l&apos;assistant du matin et
                la préparation des emails clients. Les brouillons restent chez
                vous : vous les relisez et vous les envoyez.
              </Text>
            </View>
          </View>
        </Section>

        <Section num="2" title="Le dossier client">
          <Text style={s.para}>
            Votre point d&apos;entrée quotidien. Le dossier centralise les
            coordonnées du client, ses contrats, ses devis, ses documents, ses
            sinistres, son devoir de conseil et les emails échangés avec lui.
          </Text>
          <Text style={s.para}>
            <Text style={s.strong}>Renseignez son email dès la création.</Text>{" "}
            C&apos;est lui qui permet de rattacher automatiquement les messages au
            bon dossier, et il est indispensable à la signature électronique.
          </Text>
          <Text style={s.para}>
            Le dossier avance selon son statut — nouveau, en cours, conseil prêt,
            en attente de signature, signé. Vous n&apos;avez pas à le faire
            évoluer à la main : il suit ce que vous faites.
          </Text>
          <Callout title="Le nom du dossier ne sort jamais">
            L&apos;intitulé que vous donnez à un dossier est un repère interne.
            Il n&apos;apparaît dans aucun document ni aucun email adressé au
            client.
          </Callout>
        </Section>
      </Page>

      {/* ---------- Page 3 ---------- */}
      <Page size="A4" style={s.page}>
        <RunningChrome />

        <Section num="3" title="Le devoir de conseil">
          <Text style={s.para}>
            Le cœur de l&apos;outil. Trois étapes, dans cet ordre : chacune
            déverrouille la suivante.
          </Text>

          <Step n={1} title="Relire et ajuster">
            FalconDraft rédige une première version — les exigences et besoins du
            client, puis les motifs qui justifient le contrat conseillé — à partir
            du dossier et du dernier devis validé. Relisez, corrigez, complétez,
            puis validez.
          </Step>

          <Step n={2} title="Générer le document">
            Le PDF reprend vos mentions de cabinet, l&apos;identité du client, ses
            exigences, le contrat conseillé et les motifs. Si des informations
            manquent, elles vous sont signalées avant génération plutôt
            qu&apos;imprimées en blanc dans le document.
          </Step>

          <Step n={3} title="Faire signer et envoyer">
            <Text style={s.strong}>Préparer la signature</Text> crée la demande —
            rien n&apos;est envoyé au client à ce stade, vous récupérez un lien.{" "}
            <Text style={s.strong}>Préparer le brouillon</Text> dépose dans votre
            Outlook un email prêt à relire, avec le lien et vos documents
            d&apos;information en pièces jointes. Le devoir de conseil
            lui-même n&apos;est pas joint : le client le lit au moment de signer.
          </Step>

          <Callout title="N'ouvrez jamais le lien de signature vous-même">
            Il est nominatif : son ouverture serait enregistrée comme celle du
            client dans la preuve de signature. Utilisez « Copier le lien » pour
            le transmettre.
          </Callout>

          <Text style={s.para}>
            Ensuite le suivi se met à jour tout seul : demande préparée, ouverte
            par le client, signée. Vous pouvez relancer d&apos;un clic, et des
            rappels partent automatiquement au bout de trois jours puis tous les
            quatre jours, trois fois au maximum.
          </Text>
          <Text style={s.para}>
            Une fois signé, le document signé et la{" "}
            <Text style={s.strong}>preuve de signature</Text> sont rangés dans le
            dossier. Cette preuve horodate l&apos;identité du signataire, la date
            et l&apos;adresse IP : c&apos;est elle qui fait foi en cas de litige.
          </Text>

          <Text style={[s.stepTitle, { marginTop: 4, marginBottom: 5 }]}>
            Si vous modifiez le document après coup
          </Text>
          <Bullet>
            <Text style={s.strong}>Signature en cours</Text> — la demande est
            annulée et l&apos;ancien lien cesse de fonctionner. Le client ne peut
            pas signer une version que vous avez corrigée entre-temps.
          </Bullet>
          <Bullet>
            <Text style={s.strong}>Document déjà signé</Text> — un bandeau vous
            signale que la version signée ne correspond plus au contenu actuel et
            vous propose de faire signer la nouvelle. L&apos;ancienne reste
            archivée au dossier.
          </Bullet>
          <Bullet>
            <Text style={s.strong}>Signature sur papier</Text> — « Signé hors
            ligne » clôt l&apos;étape manuellement.
          </Bullet>
        </Section>
      </Page>

      {/* ---------- Page 4 ---------- */}
      <Page size="A4" style={s.page}>
        <RunningChrome />

        <Section num="4" title="L'assistant Outlook">
          <Text style={s.para}>
            Chaque matin, FalconDraft trie le courrier arrivé dans votre boîte et
            vous en propose une lecture : ce qui concerne quel dossier, et ce
            qu&apos;il y aurait à faire.
          </Text>
          <Text style={s.para}>
            Les suggestions sont des propositions, jamais des actions déjà faites
            — créer un dossier, préparer une réponse, déclarer un sinistre,
            signaler un renouvellement, classer une pièce jointe. Vous acceptez ou
            vous écartez. Une pièce jointe peut être consultée avant d&apos;être
            classée, et rattachée au bon dossier si l&apos;assistant s&apos;est
            trompé de client.
          </Text>
        </Section>

        <Section num="5" title="Le reste de votre espace">
          <Module name="Contrats">
            Votre portefeuille, avec le suivi des renouvellements et des tacites
            reconductions. Un contrat peut être importé depuis un PDF :
            l&apos;IA en extrait les informations, vous validez.
          </Module>
          <Module name="Documents">
            La GED du cabinet. Tout ce qui est classé depuis un dossier ou depuis
            l&apos;assistant Outlook s&apos;y retrouve.
          </Module>
          <Module name="Commissions">
            Bordereaux compagnies, rapprochement avec vos contrats, rétrocessions
            aux apporteurs.
          </Module>
          <Module name="Sinistres">
            Le suivi de vos déclarations en cours.
          </Module>
          <Module name="Copilote IA">
            Accessible partout, il connaît votre portefeuille et répond sur vos
            dossiers : échéances, contrats d&apos;un client, recherche dans les
            emails.
          </Module>
        </Section>

        <View style={s.principle}>
          <Text style={s.principleTitle}>Deux réflexes</Text>
          <Text style={s.principleText}>
            Tout ce qui sort de l&apos;outil doit avoir été relu par vous :
            FalconDraft fait gagner du temps de rédaction et de classement, il ne
            se substitue pas à votre responsabilité professionnelle.
            {"\n\n"}
            Une question, un doute, un comportement inattendu : écrivez-nous
            plutôt que de contourner. La plupart des blocages se règlent en
            quelques minutes.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/* ------------------------------------------------------------------ */

async function main() {
  const logo = await fs
    .readFile(path.join(process.cwd(), LOGO))
    .catch(() => null);
  if (!logo) console.warn(`[guide] logo introuvable (${LOGO}), page de couverture sans logo`);

  const pdf = await renderToBuffer(<Guide logo={logo} />);
  const out = path.join(process.cwd(), OUT);
  await fs.writeFile(out, pdf);
  console.log(`${OUT} — ${(pdf.byteLength / 1024).toFixed(0)} Ko`);
}

void main();
