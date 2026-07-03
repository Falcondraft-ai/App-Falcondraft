import * as React from "react";
import { Image, Text, View } from "@react-pdf/renderer";
import { styles } from "./theme";
import type { CabinetInfo } from "@/lib/broker/advice-document";

/** Cabinet header band: logo (or wordmark) on the left, coordinates on the right. */
export function Header({
  cabinet,
  logo,
}: {
  cabinet: CabinetInfo;
  logo?: Buffer | null;
}) {
  const metaLines = [
    cabinet.address,
    [cabinet.phone, cabinet.email].filter(Boolean).join("  ·  "),
    cabinet.website,
  ].filter((l) => l && l.trim().length > 0);

  return (
    <View style={styles.header} fixed>
      {logo ? (
        /* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image (PDF, not HTML) */
        <Image style={styles.logo} src={{ data: logo, format: "png" }} />
      ) : (
        <View>
          <Text style={styles.headerName}>{cabinet.legalName || "Cabinet"}</Text>
          <View style={styles.goldRule} />
        </View>
      )}
      <View style={styles.headerRight}>
        {logo ? (
          <Text style={styles.headerName}>{cabinet.legalName}</Text>
        ) : null}
        {metaLines.map((line, i) => (
          <Text key={i} style={styles.headerMeta}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Fixed footer: legal one-liner repeated on every page + page number. */
export function Footer({ cabinet }: { cabinet: CabinetInfo }) {
  const parts = [
    cabinet.legalName,
    cabinet.legalForm && cabinet.capital
      ? `${cabinet.legalForm} au capital de ${cabinet.capital}`
      : cabinet.legalForm,
    cabinet.siren ? `SIREN ${cabinet.siren}` : null,
    cabinet.oriasNumber ? `ORIAS ${cabinet.oriasNumber}` : null,
  ].filter(Boolean);

  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{parts.join("  ·  ")}</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

export function DocTitle({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View>
      <Text style={styles.docKicker}>{kicker}</Text>
      <Text style={styles.docTitle}>{title}</Text>
      {subtitle ? <Text style={styles.docSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} id={id} minPresenceAhead={48}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Key/value row. Empty values render a muted "[à compléter]" placeholder. */
export function KeyValue({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  const filled = value != null && value.trim().length > 0;
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={filled ? styles.kvValue : styles.kvValueMuted}>
        {filled ? value : "[à compléter]"}
      </Text>
    </View>
  );
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>
            {item.replace(/^[-–•·]\s*/, "")}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function SignatureRow({
  clientName,
  signatureTag,
}: {
  clientName: string;
  /** DocuSeal field tag, placed (invisibly) in the client box for e-signature. */
  signatureTag?: string | null;
}) {
  return (
    <View style={styles.signatureRow} wrap={false}>
      <View style={styles.signatureBox}>
        <View style={styles.signatureLine}>
          {signatureTag ? (
            <Text style={styles.signatureTag}>{signatureTag}</Text>
          ) : null}
        </View>
        <Text style={styles.signatureLabel}>Le Client</Text>
        <Text style={styles.signatureHint}>
          {clientName || "Nom du client / Raison sociale"}
        </Text>
      </View>
    </View>
  );
}

export function Remittance({ date }: { date: string }) {
  return (
    <Text style={styles.remittance}>
      Remis au client le {date} — fait en deux (2) exemplaires.
    </Text>
  );
}
