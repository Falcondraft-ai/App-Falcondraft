import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://falcondraft:placeholder@localhost:5432/falcondraft",
  },
  strict: true,
  verbose: true,
});
