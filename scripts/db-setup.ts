// `pnpm dev` runs this before starting Next: applies migrations and seeds an empty database.
import { createDb } from "../src/db/client";
import { databaseUrl, loadDotEnv } from "../src/db/env";
import { migrateDatabase } from "../src/db/migrate";
import { seedIfEmpty } from "../src/db/seed";

loadDotEnv();
const url = databaseUrl();

await migrateDatabase(url);
console.log("✓ Migrations aplicadas");

const db = createDb(url);
try {
  const seeded = await seedIfEmpty(db);
  console.log(
    seeded
      ? "✓ Banco vazio: seed aplicado"
      : "✓ Banco já tem dados: seed pulado",
  );
} finally {
  await db.$client.end();
}
