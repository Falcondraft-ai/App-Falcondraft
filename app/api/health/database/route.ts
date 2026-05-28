import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createHealthResponse,
  getHealthTimestamp,
} from "../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = getHealthTimestamp();
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    console.warn("[health:database] Database health check failed.");

    return createHealthResponse(
      {
        status: "error",
        service: "database",
        timestamp,
        error: "Database health check failed",
      },
      503,
    );
  }

  const { error } = await supabase
    .from("organizations")
    .select("id", { head: true })
    .limit(1);

  if (error) {
    console.warn("[health:database] Database health check failed.");

    return createHealthResponse(
      {
        status: "error",
        service: "database",
        timestamp,
        error: "Database health check failed",
      },
      503,
    );
  }

  return createHealthResponse({
    status: "ok",
    service: "database",
    timestamp,
  });
}
