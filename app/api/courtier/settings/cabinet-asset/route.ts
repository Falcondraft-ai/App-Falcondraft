import { NextResponse, type NextRequest } from "next/server";
import { canManageWorkspace } from "@/lib/auth/workspace-permissions";
import { CABINET_BRANDING_FOLDER } from "@/lib/broker/cabinet";
import type { CabinetComplianceInfo } from "@/lib/broker/compliance";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import { requireBrokerApiContext } from "@/lib/broker/server";
import { parseCabinetCompliance } from "@/lib/broker/settings";

// Files printed on or joined to the devoir de conseil, per company: the logo of
// the letterhead and the two legal annexes. Stored under the organization's own
// Storage prefix; the fiche only keeps the path (see lib/broker/cabinet.ts).

type AssetKind = "logo" | "annexEntreeEnRelation" | "annexMentions";

const ASSETS: Record<
  AssetKind,
  { key: keyof CabinetComplianceInfo; maxBytes: number; label: string }
> = {
  logo: { key: "logoUrl", maxBytes: 2 * 1024 * 1024, label: "logo" },
  annexEntreeEnRelation: {
    key: "annexEntreeEnRelation",
    maxBytes: 10 * 1024 * 1024,
    label: "document d’entrée en relation",
  },
  annexMentions: {
    key: "annexMentions",
    maxBytes: 10 * 1024 * 1024,
    label: "document de mentions",
  },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

function isAssetKind(value: unknown): value is AssetKind {
  return typeof value === "string" && value in ASSETS;
}

/** What the bytes really are — the file name and MIME type are the client's word. */
function sniff(bytes: Buffer): { ext: string; mime: string } | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: "png", mime: "image/png" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") {
    return { ext: "pdf", mime: "application/pdf" };
  }
  return null;
}

type Auth = Extract<Awaited<ReturnType<typeof requireBrokerApiContext>>, { success: true }>;

/** The fiche the asset belongs to: a profile's, or the organization's. */
async function readFiche(auth: Auth, profileId: string | null) {
  if (profileId) {
    const { data } = await auth.adminSupabase
      .from("broker_profiles")
      .select("id, cabinet")
      .eq("organization_id", auth.organizationId)
      .eq("id", profileId)
      .maybeSingle();
    return data ? parseCabinetCompliance(data.cabinet) : null;
  }
  const settings = (auth.context.organization?.broker_settings ?? {}) as Record<string, unknown>;
  return parseCabinetCompliance(settings.compliance);
}

async function writeFiche(
  auth: Auth,
  profileId: string | null,
  fiche: CabinetComplianceInfo,
): Promise<boolean> {
  if (profileId) {
    const { error } = await auth.adminSupabase
      .from("broker_profiles")
      .update({ cabinet: fiche, updated_at: new Date().toISOString() })
      .eq("organization_id", auth.organizationId)
      .eq("id", profileId);
    return !error;
  }
  const settings = (auth.context.organization?.broker_settings ?? {}) as Record<string, unknown>;
  const { error } = await auth.adminSupabase
    .from("organizations")
    .update({ broker_settings: { ...settings, compliance: fiche } })
    .eq("id", auth.organizationId);
  return !error;
}

/** Removes a previously stored file — only ever inside this organization's branding folder. */
async function removeStored(auth: Auth, ref: string) {
  if (!ref.startsWith(`${auth.organizationId}/${CABINET_BRANDING_FOLDER}/`)) return;
  await auth.adminSupabase.storage.from(BROKER_FILES_BUCKET).remove([ref]);
}

async function authorize() {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return { error: jsonError(auth.message, auth.status, auth.reason) };
  if (!canManageWorkspace(auth.context.membership?.role)) {
    return {
      error: jsonError(
        "Seul un gestionnaire peut modifier ces paramètres.",
        403,
        "insufficient_role",
      ),
    };
  }
  return { auth };
}

export async function POST(request: NextRequest) {
  const { auth, error } = await authorize();
  if (!auth) return error;

  const form = await request.formData().catch(() => null);
  const kind = form?.get("kind");
  const file = form?.get("file");
  const rawProfile = form?.get("profileId");
  const profileId = typeof rawProfile === "string" && rawProfile ? rawProfile : null;

  if (!isAssetKind(kind) || !(file instanceof File)) {
    return jsonError("Fichier manquant.", 400, "invalid_payload");
  }
  if (profileId && !UUID.test(profileId)) {
    return jsonError("Profil introuvable.", 404, "profile_not_found");
  }
  const asset = ASSETS[kind];
  if (file.size === 0 || file.size > asset.maxBytes) {
    return jsonError(
      `Le ${asset.label} doit peser moins de ${Math.round(asset.maxBytes / 1024 / 1024)} Mo.`,
      413,
      "too_large",
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniff(bytes);
  const expected = kind === "logo" ? ["png", "jpg"] : ["pdf"];
  if (!type || !expected.includes(type.ext)) {
    return jsonError(
      kind === "logo"
        ? "Le logo doit être une image PNG ou JPEG."
        : "Le document doit être un PDF.",
      415,
      "unsupported_type",
    );
  }

  const fiche = await readFiche(auth, profileId);
  if (!fiche) return jsonError("Profil introuvable.", 404, "profile_not_found");

  const path = `${auth.organizationId}/${CABINET_BRANDING_FOLDER}/${profileId ?? "cabinet"}/${kind}-${Date.now()}.${type.ext}`;
  const { error: uploadError } = await auth.adminSupabase.storage
    .from(BROKER_FILES_BUCKET)
    .upload(path, bytes, { contentType: type.mime, upsert: false });
  if (uploadError) {
    return jsonError("Le dépôt du fichier n’a pas abouti.", 500, "upload_failed");
  }

  const previous = fiche[asset.key];
  const saved = await writeFiche(auth, profileId, { ...fiche, [asset.key]: path });
  if (!saved) {
    await auth.adminSupabase.storage.from(BROKER_FILES_BUCKET).remove([path]);
    return jsonError("Enregistrement impossible.", 500, "save_failed");
  }
  if (previous) await removeStored(auth, previous);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { auth, error } = await authorize();
  if (!auth) return error;

  const kind = request.nextUrl.searchParams.get("kind");
  const rawProfile = request.nextUrl.searchParams.get("profileId");
  const profileId = rawProfile || null;
  if (!isAssetKind(kind)) return jsonError("Paramètres invalides.", 400, "invalid_payload");
  if (profileId && !UUID.test(profileId)) {
    return jsonError("Profil introuvable.", 404, "profile_not_found");
  }

  const fiche = await readFiche(auth, profileId);
  if (!fiche) return jsonError("Profil introuvable.", 404, "profile_not_found");

  const key = ASSETS[kind].key;
  const previous = fiche[key];
  const saved = await writeFiche(auth, profileId, { ...fiche, [key]: "" });
  if (!saved) return jsonError("Enregistrement impossible.", 500, "save_failed");
  if (previous) await removeStored(auth, previous);

  return NextResponse.json({ success: true });
}
