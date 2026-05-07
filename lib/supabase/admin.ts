import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let adminClient: SupabaseClient<Database> | null = null;
let cachedSupabaseUrl: string | null = null;
let cachedServiceRoleKey: string | null = null;

function getSupabaseAdminEnvironment() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

  return {
    url,
    serviceRoleKey,
  };
}

export function getSupabaseAdminClient(): SupabaseClient<Database> | null {
  const { url, serviceRoleKey } = getSupabaseAdminEnvironment();

  if (!url || !serviceRoleKey) {
    return null;
  }

  if (
    !adminClient ||
    cachedSupabaseUrl !== url ||
    cachedServiceRoleKey !== serviceRoleKey
  ) {
    adminClient = createClient<Database>(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    cachedSupabaseUrl = url;
    cachedServiceRoleKey = serviceRoleKey;
  }

  return adminClient;
}
