import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return null;
  }

  const queryClient = postgres(databaseUrl, {
    prepare: false,
  });

  return drizzle(queryClient, { schema });
}

let database: ReturnType<typeof createDatabase> | null = null;

export function getDb() {
  database ??= createDatabase();

  return database;
}

export { schema };
