import { defineConfig } from "drizzle-kit";

// drizzle-kit runs DDL which the pgbouncer transaction pooler on :6543
// can't always serve. Prefer a dedicated DIRECT_URL (session mode :5432)
// for migrations; fall back to DATABASE_URL if DIRECT_URL isn't set.
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL must be set for drizzle-kit.");
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl,
  },
});
