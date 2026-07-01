import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Staged chat uploads live under `<orgId>/_agent/<userId>/` and are removed once
// filed into a dossier. Orphans (attached then never filed) are purged after
// this many days.
const MAX_AGE_DAYS = 7;
const LIST_LIMIT = 1000;
const REMOVE_CHUNK = 100;

type StorageEntry = {
  name: string;
  id: string | null;
  created_at?: string | null;
};

/**
 * Internal cron endpoint: purges staged assistant chat uploads older than 7
 * days from the broker bucket. Driven natively by Vercel Cron (GET) or any
 * scheduler with the shared secret — never from the browser. Runs with the
 * service-role client, no user session.
 *
 *   Vercel Cron: `Authorization: Bearer <CRON_SECRET>` (automatic).
 *   Manual:      header `X-N8N-Secret` / `x-cron-secret` = CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { success: false, reason: "cron_not_configured" },
      { status: 503 },
    );
  }
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { success: false, reason: "unauthorized" },
      { status: 401 },
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { success: false, reason: "service_unconfigured" },
      { status: 500 },
    );
  }

  const bucket = admin.storage.from(BROKER_FILES_BUCKET);
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  async function list(prefix: string): Promise<StorageEntry[]> {
    const { data, error } = await bucket.list(prefix, { limit: LIST_LIMIT });
    if (error) {
      console.error("[agent-cleanup] list failed:", prefix, error.message);
      return [];
    }
    return (data ?? []) as StorageEntry[];
  }

  // Folders (prefixes) have a null id; files carry an id + created_at.
  const isFolder = (e: StorageEntry) => e.id === null;

  const stalePaths: string[] = [];

  // Root entries are the organization folders.
  const orgs = (await list("")).filter(isFolder);
  for (const org of orgs) {
    const userFolders = (await list(`${org.name}/_agent`)).filter(isFolder);
    for (const user of userFolders) {
      const base = `${org.name}/_agent/${user.name}`;
      const files = (await list(base)).filter((e) => !isFolder(e));
      for (const file of files) {
        const ts = file.created_at ? new Date(file.created_at).getTime() : 0;
        // Missing/invalid timestamp → treat as stale (safe: staging only).
        if (!ts || ts < cutoff) {
          stalePaths.push(`${base}/${file.name}`);
        }
      }
    }
  }

  let removed = 0;
  for (let i = 0; i < stalePaths.length; i += REMOVE_CHUNK) {
    const chunk = stalePaths.slice(i, i + REMOVE_CHUNK);
    const { error } = await bucket.remove(chunk);
    if (error) {
      console.error("[agent-cleanup] remove failed:", error.message);
      continue;
    }
    removed += chunk.length;
  }

  return NextResponse.json({ success: true, scanned: stalePaths.length, removed });
}
