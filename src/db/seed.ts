import { sql } from "drizzle-orm";
import { indiceDosEmbeddings, resolverEmbeddings } from "../assistente";
import {
  type IndiceDosTrechos,
  indexarTrechos,
  lerVetoresGravados,
  semente,
  type Trecho,
  trechosDosDocumentos,
} from "../catalogo";
import { substituirTrechos } from "./base-de-trechos-postgres";
import { substituirCatalogo } from "./base-postgres";
import type { Db } from "./client";
import { trechos as tabelaDeTrechos } from "./schema";

type Env = Record<string, string | undefined>;

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

/** True when the stored Trechos are exactly `esperados`, embedded with `indice`'s model. */
async function trechosEmDia(
  db: Db,
  indice: IndiceDosTrechos,
  esperados: Trecho[],
): Promise<boolean> {
  const guardados = await db
    .select({
      id: tabelaDeTrechos.id,
      hash: tabelaDeTrechos.hash,
      modelo: tabelaDeTrechos.modelo,
    })
    .from(tabelaDeTrechos);
  const hashGuardado = new Map(guardados.map((g) => [g.id, g.hash]));
  return (
    guardados.length === esperados.length &&
    guardados.every((g) => g.modelo === indice.modelo) &&
    esperados.every((t) => hashGuardado.get(t.id) === t.hash)
  );
}

/**
 * Brings the Base de Trechos up to date with the Documentos and the model in
 * EMBEDDINGS. Unlike the catalog, it runs on every setup: the Trechos hold
 * no one's data, and a changed Documento has to reach the search. The
 * recorded vectors serve when they match the model, so the default setup
 * needs neither key nor network; only the vectors missing from them are
 * embedded, which asks for the provider's key.
 */
export async function sincronizarTrechos(
  db: Db,
  env: Env,
): Promise<"em-dia" | "indexados"> {
  const indice = indiceDosEmbeddings(env);
  const documentos = trechosDosDocumentos();
  if (await trechosEmDia(db, indice, documentos)) return "em-dia";
  const indexados = await indexarTrechos({
    trechos: documentos,
    gravados: lerVetoresGravados(),
    indice,
    embedarTrechos: (textos) => resolverEmbeddings(env).embedarTrechos(textos),
  });
  await substituirTrechos(db, indice, indexados);
  return "indexados";
}
