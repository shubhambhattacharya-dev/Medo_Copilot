import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { assertProductionEnv } from "../src/lib/env";

async function main() {
  const env = assertProductionEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run migrations");
  }

  const sql = neon(env.DATABASE_URL);
  const migration = readFileSync(join(process.cwd(), "migrations", "001_initial.sql"), "utf8");
  await sql.query(migration);
  console.log("Migrations applied successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
