// `pnpm db:reset`: recreates the database from scratch, migrates and seeds it.
import { createDb } from "../src/db/client";
import { databaseUrl, loadDotEnv } from "../src/db/env";
import { migrateDatabase } from "../src/db/migrate";
import { recreateDatabase } from "../src/db/recreate";
import { seed } from "../src/db/seed";

loadDotEnv();
const url = databaseUrl();

await recreateDatabase(url);
console.log("✓ Banco recriado do zero");

await migrateDatabase(url);
console.log("✓ Migrations aplicadas");

const db = createDb(url);
try {
  await seed(db);
  console.log("✓ Seed aplicado");
} finally {
  await db.$client.end();
}
