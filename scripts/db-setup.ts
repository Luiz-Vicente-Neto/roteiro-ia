// `pnpm dev` runs this before starting Next: applies migrations, seeds an
// empty database and brings the Trechos up to date with the Documentos.
import { createDb } from "../src/db/client";
import { databaseUrl, loadDotEnv } from "../src/db/env";
import { migrateDatabase } from "../src/db/migrate";
import { seedIfEmpty, sincronizarTrechos } from "../src/db/seed";

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
  console.log(
    (await sincronizarTrechos(db, process.env)) === "em-dia"
      ? "✓ Trechos já em dia"
      : "✓ Trechos indexados",
  );
} finally {
  await db.$client.end();
}
