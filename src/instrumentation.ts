/**
 * Runs once when the server starts (not during `next build`): a bad MODELO,
 * EMBEDDINGS or limit, a missing key (docs/adr/0004), or Trechos indexed with another
 * embedding model (docs/adr/0006) stop the server with a clear error, instead
 * of surfacing on the first message.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resolverModelo, resolverEmbeddings, resolverLimites } = await import(
    "./assistente"
  );
  const { conferirIndiceDosTrechos } = await import("./catalogo");
  const { createDb } = await import("./db/client");
  const { databaseUrl } = await import("./db/env");
  const { criarBaseDeTrechosPostgres } = await import(
    "./db/base-de-trechos-postgres"
  );
  resolverModelo(process.env);
  resolverLimites(process.env);
  const { indice } = resolverEmbeddings(process.env);
  const db = createDb(databaseUrl());
  try {
    await conferirIndiceDosTrechos(criarBaseDeTrechosPostgres(db), indice);
  } finally {
    await db.$client.end();
  }
}
