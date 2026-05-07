import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseBrowserClient() {
  const url = supabaseUrl;
  const anonKey = supabaseAnonKey;

  if (!url || !anonKey) {
    return null;
  }

  browserClient ??= createBrowserClient<Database>(url, anonKey);

  return browserClient;
}
