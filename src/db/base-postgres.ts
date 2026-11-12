// Postgres implementation of the Base do Catálogo. Drizzle stays inside this
// adapter: rows are translated to the catalog's domain types on the way out.
import { type AnyColumn, sql } from "drizzle-orm";
import type { BaseDoCatalogo, DadosDoCatalogo } from "../catalogo";
import type { Db } from "./client";
import { destinos, hoteis, pacotes, saidas } from "./schema";

/** Code-point order, matching the in-memory Base instead of the server's locale. */
const byCodePoint = (coluna: AnyColumn) => sql`${coluna} collate "C"`;

export function criarBasePostgres(db: Db): BaseDoCatalogo {
  return {
    async lerCatalogo() {
      const [destinoRows, hotelRows, pacoteRows, saidaRows] = await Promise.all(
        [
          db.select().from(destinos).orderBy(byCodePoint(destinos.slug)),
          db.select().from(hoteis).orderBy(byCodePoint(hoteis.slug)),
          db.select().from(pacotes).orderBy(byCodePoint(pacotes.slug)),
          db
            .select()
            .from(saidas)
            .orderBy(byCodePoint(saidas.pacote), saidas.data),
        ],
      );
      return {
        destinos: destinoRows.map(({ slug, nome }) => ({ slug, nome })),
        hoteis: hotelRows.map(({ slug, nome, destino, aceitaPet }) => ({
          slug,
          nome,
          destino,
          aceitaPet,
        })),
        pacotes: pacoteRows.map(({ slug, nome, hotel, noites, inclui }) => ({
          slug,
          nome,
          hotel,
          noites,
          inclui,
        })),
        saidas: saidaRows.map(({ pacote, data, vagasTotais }) => ({
          pacote,
          data,
          vagasTotais,
        })),
      };
    },
  };
}

/** Replaces the whole catalog with `dados`, atomically. Used by the seed and the contract tests. */
export async function substituirCatalogo(
  db: Db,
  dados: DadosDoCatalogo,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Children first, so foreign keys never point at a deleted row.
    await tx.delete(saidas);
    await tx.delete(pacotes);
    await tx.delete(hoteis);
    await tx.delete(destinos);
    if (dados.destinos.length) await tx.insert(destinos).values(dados.destinos);
    if (dados.hoteis.length) await tx.insert(hoteis).values(dados.hoteis);
    if (dados.pacotes.length) await tx.insert(pacotes).values(dados.pacotes);
    if (dados.saidas.length) await tx.insert(saidas).values(dados.saidas);
  });
}
