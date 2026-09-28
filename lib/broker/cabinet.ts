import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CabinetInfo } from "@/lib/broker/advice-document";
import type { CabinetComplianceInfo } from "@/lib/broker/compliance";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import {
  parseBrokerSettings,
  parseCabinetCompliance,
} from "@/lib/broker/settings";
import type { MailDraftAttachment } from "@/lib/email/mailbox";
import type {
  BrokerProfileRow,
  Database,
  OrganizationRow,
} from "@/types/database";

/**
 * Which company a legal document is issued under.
 *
 * One broker account can shelter several companies — each profile may exercise
 * under its own name, ORIAS number and RCP. The fiche printed on a devoir de
 * conseil must be the one of the company that gives the advice.
 *
 * The FIRST profile id given decides; callers pass them most-specific first
 * (the profile that prepared the advice, then the dossier's, then the active
 * one). A profile without its own fiche falls back to the organization's — we
 * never borrow the next profile's fiche, that would print another company's
 * ORIAS number on the document.
 */

/** Storage folder (under the organization's prefix) holding branding assets. */
export const CABINET_BRANDING_FOLDER = "_branding";

/** A profile carries its own fiche once a legal name is set on it. */
export function profileCabinetFiche(
  profile: Pick<BrokerProfileRow, "cabinet"> | null | undefined,
): CabinetComplianceInfo | null {
  if (!profile?.cabinet) return null;
  const fiche = parseCabinetCompliance(profile.cabinet);
  return fiche.legalName.trim() ? fiche : null;
}

export type ResolvedCabinet = {
  cabinet: CabinetInfo;
  /** Profile whose fiche is used — null when the organization's fiche is. */
  profileId: string | null;
};

export async function resolveCabinet(params: {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  organization: Pick<OrganizationRow, "broker_settings"> | null | undefined;
  profileIds: (string | null | undefined)[];
}): Promise<ResolvedCabinet> {
  const settings = parseBrokerSettings(params.organization);
  const organizationFiche: ResolvedCabinet = {
    cabinet: { ...settings.compliance, partnerInsurers: settings.partnerInsurers },
    profileId: null,
  };

  const deciding = params.profileIds.find((id): id is string => Boolean(id));
  if (!deciding) return organizationFiche;

  const { data } = await params.supabase
    .from("broker_profiles")
    .select("id, cabinet")
    .eq("organization_id", params.organizationId)
    .eq("id", deciding)
    .maybeSingle();
  const fiche = profileCabinetFiche(data as Pick<BrokerProfileRow, "cabinet"> | null);
  if (!fiche) return organizationFiche;

  return {
    cabinet: { ...fiche, partnerInsurers: settings.partnerInsurers },
    profileId: deciding,
  };
}

/**
 * Same resolution for callers that only hold the advice row (signature
 * reminders): the dossier's profile is looked up here.
 */
export async function resolveAdviceCabinet(params: {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  organization: Pick<OrganizationRow, "broker_settings"> | null | undefined;
  advice: { profile_id: string | null; client_id: string };
  activeProfileId?: string | null;
}): Promise<ResolvedCabinet> {
  let clientProfileId: string | null = null;
  if (!params.advice.profile_id) {
    const { data } = await params.supabase
      .from("broker_clients")
      .select("profile_id")
      .eq("organization_id", params.organizationId)
      .eq("id", params.advice.client_id)
      .maybeSingle();
    clientProfileId = (data as { profile_id: string | null } | null)?.profile_id ?? null;
  }
  return resolveCabinet({
    supabase: params.supabase,
    organizationId: params.organizationId,
    organization: params.organization,
    profileIds: [params.advice.profile_id, clientProfileId, params.activeProfileId],
  });
}

/**
 * Bytes of a branding asset (logo, legal annex). Two sources: a public asset
 * ("/brand/…", the first cabinet's legacy files) or a file under the
 * organization's own Storage prefix. Anything else is ignored, so a fiche can
 * never point the renderer at another tenant's files.
 */
async function loadCabinetAsset(
  ref: string | null | undefined,
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<Buffer | null> {
  const value = ref?.trim();
  if (!value || value.includes("..")) return null;

  if (value.startsWith("/")) {
    try {
      return await fs.readFile(path.join(process.cwd(), "public", value.slice(1)));
    } catch {
      return null;
    }
  }

  if (!value.startsWith(`${organizationId}/${CABINET_BRANDING_FOLDER}/`)) return null;
  const { data } = await supabase.storage.from(BROKER_FILES_BUCKET).download(value);
  if (!data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export function loadCabinetLogoFor(
  cabinet: CabinetComplianceInfo,
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<Buffer | null> {
  return loadCabinetAsset(cabinet.logoUrl, supabase, organizationId);
}

const ANNEXES: {
  key: "annexEntreeEnRelation" | "annexMentions";
  filename: string;
}[] = [
  { key: "annexEntreeEnRelation", filename: "Document d'entrée en relation.pdf" },
  { key: "annexMentions", filename: "Mentions d'information.pdf" },
];

/**
 * The issuing company's legal annexes, joined to the devoir de conseil email.
 * Only the ones that company has filed — a missing annex is skipped, never
 * replaced by another company's.
 */
export async function loadCabinetAnnexes(
  cabinet: CabinetComplianceInfo,
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<MailDraftAttachment[]> {
  const attachments: MailDraftAttachment[] = [];
  for (const annex of ANNEXES) {
    const bytes = await loadCabinetAsset(cabinet[annex.key], supabase, organizationId);
    if (!bytes) continue;
    attachments.push({
      filename: annex.filename,
      contentType: "application/pdf",
      contentBase64: bytes.toString("base64"),
    });
  }
  return attachments;
}
