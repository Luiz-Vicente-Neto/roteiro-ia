import { sql } from "drizzle-orm";
import { semente } from "../catalogo";
import { substituirCatalogo } from "./base-postgres";
import type { Db } from "./client";

/** Loads the catalog from the same source the in-memory Base uses in tests. */
export async function seed(db: Db): Promise<void> {
  await substituirCatalogo(db, semente);
}

/**
 * The database is empty when no table in the `public` schema has a row.
 * Drizzle's migration journal lives in the `drizzle` schema, so it doesn't count.
 */
export async function isDatabaseEmpty(db: Db): Promise<boolean> {
  const tables = await db.execute<{ name: string }>(
    sql`select table_name as name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  for (const { name } of tables) {
    const [{ hasRows }] = await db.execute<{ hasRows: boolean }>(
      sql`select exists (select 1 from ${sql.identifier(name)}) as "hasRows"`,
    );
    if (hasRows) return false;
  }
  return true;
}

/** Seeds only an empty database, so restarting `pnpm dev` keeps test Pré-reservas. */
export async function seedIfEmpty(db: Db): Promise<boolean> {
  if (!(await isDatabaseEmpty(db))) return false;
  await seed(db);
  return true;
}
