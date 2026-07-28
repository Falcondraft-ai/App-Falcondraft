/* eslint-disable react/no-unescaped-entities -- PDF template rendered by react-pdf (not HTML); apostrophes are literal text. */
import * as React from "react";
import { Document, Link, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./theme";
import {
  Bullets,
  DocTitle,
  Footer,
  Header,
  KeyValue,
  Paragraph,
  Remittance,
  Section,
  SignatureBlock,
} from "./parts";
import type { AdviceDocumentData } from "@/lib/broker/advice-document";

/** Model's IARD product checklist (PLANÈTE CSCA), reproduced verbatim. */
const PRODUCTS = [
  "Assurance multirisque habitation",
  "Assurance bris de machine",
  "Assurance GAV (Garantie des Accidents de la Vie)",
  "Assurance protection juridique",
  "Assurance immeuble",
  "Assurance multirisque immeuble",
  "Assurance loyers impayés",
  "Assurance multirisque professionnelle",
  "Assurance transport",
  "Assurance automobile",
  "Assurance bateau de plaisance, bateau à moteur, jet-ski",
  "Assurance deux-roues : moto, scooter, vélo…",
  "Assurance NVEI ou EDP : trottinette électrique, hoverboard, gyroroue…",
  "Assurance des appareils nomades : téléphone, ordinateur portable, tablette…",
  "Assurance perte d'exploitation",
  "Assurance construction",
  "Assurance des risques cyber",
];

function Checkbox({ on }: { on?: boolean }) {
  return (
    <View style={on ? [styles.checkbox, styles.checkboxOn] : styles.checkbox} />
  );
}

function ProductChecklist({
  checkedLabel,
  otherText,
}: {
  checkedLabel: string | null;
  otherText: string | null;
}) {
  return (
    <View style={styles.checkGrid}>
      {PRODUCTS.map((p) => (
        <View key={p} style={styles.checkRow}>
          <Checkbox on={p === checkedLabel} />
          <Text style={styles.checkLabel}>{p}</Text>
        </View>
      ))}
      <View style={styles.checkRow}>
        <Checkbox on={Boolean(otherText)} />
        <Text style={styles.checkLabel}>
          {otherText ? `Autres : ${otherText}` : "Autres :"}
        </Text>
      </View>
    </View>
  );
}

/** Label + value, or a fillable blank line when the value is missing. */
function FormLine({ label, value }: { label: string; value?: string | null }) {
  const filled = value != null && value.trim().length > 0;
  return (
    <View style={styles.formRow}>
      <Text style={styles.formLabel}>{label}</Text>
      {filled ? (
        <Text style={styles.formValue}>{value}</Text>
      ) : (
        <View style={styles.blankLine} />
      )}
    </View>
  );
}

function Sommaire() {
  const items: [string, string, string][] = [
    ["I", "Identité du client", "sec-1"],
    ["II", "Besoins et exigences du client", "sec-2"],
    ["III", "Proposition(s) du courtier et justifications", "sec-3"],
    ["IV", "Protection de vos données personnelles", "sec-4"],
  ];
  return (
    <View style={styles.toc}>
      <Text style={styles.label}>Sommaire</Text>
      {items.map(([n, t, id]) => (
        <Link key={n} src={`#${id}`} style={styles.tocLink}>
          <Text style={styles.tocNum}>{n}</Text>
          <Text style={styles.tocText}>{t}</Text>
        </Link>
      ))}
    </View>
  );
}

/**
 * Renders the editable justification text: "- " lines become bullets.
 * Returns null when there is nothing to say — the caller then drops its
 * lead-in sentence too, rather than printing a placeholder.
 */
function Justification({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return null;
  const bullets = lines
    .filter((l) => l.startsWith("-") || l.startsWith("•"))
    .map((l) => l.replace(/^[-•]\s*/, ""));
  const paragraphs = lines.filter(
    (l) => !(l.startsWith("-") || l.startsWith("•")),
  );
  return (
    <View>
      {paragraphs.map((p, i) => (
        <Paragraph key={`p${i}`}>{p}</Paragraph>
      ))}
      {bullets.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <Bullets items={bullets} />
        </View>
      ) : null}
    </View>
  );
}

function IdentitySection({ data }: { data: AdviceDocumentData }) {
  // Only render fields we actually know → the document never shows a blank line.
  const rows: [string, string | null][] = data.isCompany
    ? [
        ["Raison sociale", data.client.companyName],
        ["Adresse", data.client.address],
        ["Email", data.client.email],
        ["Téléphone", data.client.phone],
      ]
    : [
        ["Nom", data.client.lastName],
        ["Prénom", data.client.firstName],
        ["Adresse", data.client.address],
        ["Date de naissance", data.client.birthDate],
        ["Pays de naissance", data.client.birthCountry],
        [
          "Personne politiquement exposée (Oui / Non)",
          data.client.pep,
        ],
        ["Email", data.client.email],
        ["Téléphone", data.client.phone],
      ];
  const filled = rows.filter(
    ([, value]) => value != null && value.trim().length > 0,
  );
  return (
    <Section title="I — Identité du client" id="sec-1">
      <Text style={styles.subLabel}>
        {data.isCompany ? "Personne morale" : "Personne physique"}
      </Text>
      {filled.map(([label, value]) => (
        <FormLine key={label} label={label} value={value} />
      ))}
    </Section>
  );
}

function NeedsSection({ data }: { data: AdviceDocumentData }) {
  return (
    <Section title="II — Besoins et exigences du client" id="sec-2">
      <View wrap={false}>
        <Text style={styles.subLabel}>Type de produit d'assurance souhaité</Text>
        <ProductChecklist
          checkedLabel={data.product.checkedLabel}
          otherText={data.product.otherText}
        />
      </View>

      {data.needsText ? (
        <View>
          <Text style={styles.subLabel}>
            Formalisation de la demande du client
          </Text>
          <Paragraph>{data.needsText}</Paragraph>
        </View>
      ) : null}

      {data.structuredNeeds.length > 0 ? (
        <View>
          <Text style={styles.subLabel}>
            Formalisation des exigences en termes de garantie
          </Text>
          <Bullets items={data.structuredNeeds} />
        </View>
      ) : null}
    </Section>
  );
}

function PropositionSection({ data }: { data: AdviceDocumentData }) {
  const { proposition } = data;
  const propIntro =
    proposition && proposition.product
      ? `« ${proposition.product} »${proposition.insurer ? ` proposé par ${proposition.insurer}` : ""}, lequel correspond à vos besoins et exigences sur les points suivants :`
      : null;
  return (
    <Section
      title="III — Proposition(s) du courtier et justifications"
      id="sec-3"
    >
      {/* No proposition yet → the whole block is dropped, lead-in sentence
          included. A contract description is never announced then left empty. */}
      {proposition ? (
        <View wrap={false}>
          <Text style={styles.subLabel}>Description du contrat proposé</Text>
          <Paragraph>
            {`En considération des exigences et des besoins que vous avez exprimés, nous vous proposons le(s) contrat(s) suivant(s) :`}
          </Paragraph>
          <View style={{ marginTop: 8 }}>
            <KeyValue label="Compagnie" value={proposition.insurer} />
            <KeyValue label="Produit / formule" value={proposition.product} />
            <KeyValue label="Cotisation" value={proposition.premium} />
            <KeyValue
              label="Garanties principales"
              value={proposition.coverage}
            />
            <KeyValue label="Franchise" value={proposition.deductible} />
            <KeyValue
              label="Exclusions / points de vigilance"
              value={proposition.vigilance}
            />
          </View>
        </View>
      ) : null}

      {proposition && data.justification.trim().length > 0 ? (
        <View style={{ marginTop: 12 }} wrap={false}>
          {propIntro ? <Paragraph>{propIntro}</Paragraph> : null}
          <View style={{ marginTop: 5 }}>
            <Justification text={data.justification} />
          </View>
        </View>
      ) : null}

      <View wrap={false}>
        <Text style={styles.acknowledgement}>
          Le Client reconnaît d'une part avoir pris connaissance du contenu du
          présent document préalablement à la conclusion du contrat d'assurance
          proposé ci-dessus et d'autre part que les conseils qui lui sont donnés
          correspondent en tous points à ses besoins et exigences.
        </Text>
      </View>
    </Section>
  );
}

function RgpdSection({ data }: { data: AdviceDocumentData }) {
  const { cabinet } = data;
  const contact = cabinet.email || cabinet.claimsEmail || "";
  let dpoLine: string;
  if (cabinet.dpoMode === "external" || cabinet.dpoMode === "internal") {
    dpoLine = `Conformément au règlement UE 2016/679 du 27 avril 2016, notre cabinet a désigné un Délégué à la Protection des Données${cabinet.dpoContact ? ` : ${cabinet.dpoContact}` : ""}. Vous pouvez le joindre pour toute question relative à vos données.`;
  } else {
    dpoLine =
      "En application du règlement UE 2016/679 du 27 avril 2016, notre cabinet n'est pas tenu de désigner un Délégué à la Protection des Données. Pour toute question, vous pouvez écrire à notre service dédié à la protection des données personnelles dont les coordonnées sont précisées ci-dessus.";
  }
  return (
    <Section title="IV — Protection de vos données personnelles" id="sec-4">
      <Paragraph>
        Le cabinet {cabinet.legalName} est responsable de la collecte et du
        traitement de vos données personnelles. Ces données vous sont demandées
        dans le cadre du mandat que vous nous confiez afin de pouvoir vous
        conseiller efficacement par rapport à vos besoins assuranciels, vous
        proposer des contrats d'assurance adaptés à votre situation et afin de
        gérer au quotidien notre relation. Elles sont conservées jusqu'au terme
        des délais de prescription applicables commençant à courir à compter du
        jour de résiliation du mandat.
      </Paragraph>
      <Paragraph>
        Conformément au principe de minimisation, nous ne vous demandons et ne
        traitons que les données qui nous sont nécessaires dans le cadre des
        finalités précitées. Sauf lorsque nous interrogeons les différents
        assureurs avec lesquels nous travaillons en vue du placement de votre
        risque, nous ne transmettons pas, sauf accord préalable de votre part,
        vos données à des tiers. Nous ne transférons pas vos données à des tiers
        situés en dehors du territoire de l'Union Européenne.
      </Paragraph>
      <Paragraph>
        Vous bénéficiez, au titre des données que nous vous demandons ou que vous
        nous transmettez, d'un droit d'information, d'accès et de portabilité, de
        rectification, d'effacement, de limitation et d'opposition. Pour toute
        demande d'exercice de l'un de ces droits, question ou réclamation au
        sujet de vos données, vous pouvez écrire
        {contact ? ` à ${contact}` : " au cabinet"}. Une réponse vous sera
        adressée dans un délai maximum d'un mois.
      </Paragraph>
      <Paragraph>
        Pour toute réclamation auprès de la Commission Nationale de
        l'Informatique et des Libertés (CNIL), vous pouvez écrire à : CNIL, 3
        place de Fontenoy, TSA 80715, 75334 Paris cedex 07.
      </Paragraph>
      <Paragraph>{dpoLine}</Paragraph>
      <Text style={styles.consent}>
        Vous reconnaissez avoir lu la présente clause, en accepter les termes et
        conditions et consentez ainsi à communiquer ou transférer à votre
        courtier les données vous concernant, celui-ci s'engageant à les traiter
        dans le seul cadre des finalités précitées.
      </Text>
    </Section>
  );
}

export function DevoirConseilDocument({
  data,
  logo,
}: {
  data: AdviceDocumentData;
  logo?: Buffer | null;
}) {
  const { cabinet } = data;
  const courtier = cabinet.legalName || "le cabinet";
  return (
    <Document
      title="Devoir de conseil"
      author={cabinet.legalName}
      subject="Fiche d'information et de conseil — IARD"
    >
      <Page size="A4" style={styles.page}>
        <Header cabinet={cabinet} logo={logo} />

        <DocTitle
          kicker="Devoir de conseil"
          title="Fiche d'information et de conseil"
          subtitle="Pour les contrats d'assurance de type IARD — articles L.521-1 et suivants du Code des assurances"
        />

        <Text style={styles.introPara}>
          Le présent document est à remplir préalablement à la conclusion d'un
          contrat d'assurance non-vie. Il est remis indépendamment du document
          d'entrée en relation, qui a pour finalité la présentation et les
          modalités d'exercice de {courtier}.
        </Text>
        <Text style={styles.introPara}>
          Il est rappelé que, conformément à l'article L.521-4 du Code des
          assurances et à la publication de l'ACPR sur les principes du conseil
          en assurance, {courtier} doit conseiller un contrat cohérent avec les
          exigences et besoins du souscripteur et préciser les raisons qui
          motivent ce conseil (conseil de niveau 1).
        </Text>
        <Text style={styles.introPara}>
          La complète et sincère communication des informations demandées est une
          condition indispensable à la délivrance d'un conseil éclairé. Ces
          informations permettent d'identifier les exigences et besoins du
          souscripteur dans le cadre de la souscription envisagée, et de préciser
          les raisons qui conduisent à conseiller un produit d'assurance plutôt
          qu'un autre.
        </Text>
        <Text style={styles.introPara}>
          Tout ou partie de ces questions pourront être adressées au souscripteur
          après la conclusion du contrat, à une échéance périodique adaptée au
          produit, afin de s'assurer que le contrat reste cohérent avec ses
          exigences et besoins. Si les garanties ne sont plus adaptées, {courtier}{" "}
          s'engage à proposer de les adapter ou à souscrire un nouveau contrat
          plus approprié.
        </Text>

        <Sommaire />

        <IdentitySection data={data} />
        <NeedsSection data={data} />
        <PropositionSection data={data} />
        <RgpdSection data={data} />

        {/* Page de signature — forcée sur sa propre page : le bloc n'est jamais
            coupé, et sa position devient déterministe pour la signature
            électronique (cf. lib/broker/pdf/signature-area.ts). */}
        <View break>
          <Remittance date={data.date} />
        </View>
        <SignatureBlock clientName={data.clientName} />

        <Footer cabinet={cabinet} />
      </Page>
    </Document>
  );
}
