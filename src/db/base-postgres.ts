// Postgres implementation of the Base do Catálogo. Drizzle stays inside this
// adapter: rows are translated to the catalog's domain types on the way out.
import { type AnyColumn, sql } from "drizzle-orm";
import {
  type BaseDoCatalogo,
  conferirCatalogo,
  type DadosDoCatalogo,
  type FaixaDeIdade,
  type PeriodoTarifario,
} from "../catalogo";
import type { Db } from "./client";
import {
  destinos,
  faixasDeCriancas,
  hoteis,
  pacotes,
  periodosTarifarios,
  saidas,
} from "./schema";

/** Code-point order, matching the in-memory Base instead of the server's locale. */
const byCodePoint = (coluna: AnyColumn) => sql`${coluna} collate "C"`;

export function criarBasePostgres(db: Db): BaseDoCatalogo {
  return {
    async lerCatalogo() {
      const [
        destinoRows,
        hotelRows,
        pacoteRows,
        faixaRows,
        saidaRows,
        periodoRows,
      ] = await Promise.all([
        db.select().from(destinos).orderBy(byCodePoint(destinos.slug)),
        db.select().from(hoteis).orderBy(byCodePoint(hoteis.slug)),
        db.select().from(pacotes).orderBy(byCodePoint(pacotes.slug)),
        db
          .select()
          .from(faixasDeCriancas)
          .orderBy(faixasDeCriancas.idadeMinima),
        db
          .select()
          .from(saidas)
          .orderBy(byCodePoint(saidas.pacote), saidas.data),
        db
          .select()
          .from(periodosTarifarios)
          .orderBy(
            periodosTarifarios.inicio,
            byCodePoint(periodosTarifarios.nome),
            // Feriados have no Destino and come first, as in the in-memory Base.
            sql`${byCodePoint(periodosTarifarios.destino)} nulls first`,
          ),
      ]);
      const faixasPorPacote = new Map<string, FaixaDeIdade[]>();
      for (const {
        pacote,
        idadeMinima,
        idadeMaxima,
        percentual,
      } of faixaRows) {
        const faixas = faixasPorPacote.get(pacote) ?? [];
        faixas.push({ idadeMinima, idadeMaxima, percentual });
        faixasPorPacote.set(pacote, faixas);
      }
      return {
        destinos: destinoRows.map(({ slug, nome }) => ({ slug, nome })),
        hoteis: hotelRows.map(({ slug, nome, destino, aceitaPet }) => ({
          slug,
          nome,
          destino,
          aceitaPet,
        })),
        pacotes: pacoteRows.map(
          ({
            slug,
            nome,
            hotel,
            noites,
            inclui,
            precoBase,
            aceitaCriancas,
          }) => ({
            slug,
            nome,
            hotel,
            noites,
            inclui,
            precoBase,
            politicaDeCriancas: aceitaCriancas
              ? { aceitaCriancas, faixas: faixasPorPacote.get(slug) ?? [] }
              : { aceitaCriancas },
          }),
        ),
        saidas: saidaRows.map(({ pacote, data, vagasTotais }) => ({
          pacote,
          data,
          vagasTotais,
        })),
        periodos: periodoRows.map(paraPeriodo),
      };
    },
  };
}

function paraPeriodo(
  row: typeof periodosTarifarios.$inferSelect,
): PeriodoTarifario {
  const { nome, inicio, fim, fator } = row;
  if (row.tipo === "feriado")
    return { nome, tipo: "feriado", inicio, fim, fator };
  if (row.destino === null) {
    // The table's check constraint rules this out.
    throw new Error(`Temporada "${nome}" sem Destino no banco`);
  }
  return { nome, tipo: "temporada", destino: row.destino, inicio, fim, fator };
}

function paraLinhaDePeriodo(
  periodo: PeriodoTarifario,
): typeof periodosTarifarios.$inferInsert {
  return {
    ...periodo,
    destino: periodo.tipo === "temporada" ? periodo.destino : null,
  };
}

/**
 * Replaces the whole catalog with `dados`, atomically. Used by the seed and
 * the contract tests. Checked first with the same rules as the in-memory
 * Base, since no SQL constraint sees a Política's faixas together.
 */
export async function substituirCatalogo(
  db: Db,
  dados: DadosDoCatalogo,
): Promise<void> {
  conferirCatalogo(dados);
  const linhasDePacote = dados.pacotes.map(
    ({ politicaDeCriancas, ...pacote }) => ({
      ...pacote,
      aceitaCriancas: politicaDeCriancas.aceitaCriancas,
    }),
  );
  const linhasDeFaixa = dados.pacotes.flatMap(({ slug, politicaDeCriancas }) =>
    politicaDeCriancas.aceitaCriancas
      ? politicaDeCriancas.faixas.map((faixa) => ({ pacote: slug, ...faixa }))
      : [],
  );
  await db.transaction(async (tx) => {
    // Children first, so foreign keys never point at a deleted row.
    await tx.delete(periodosTarifarios);
    await tx.delete(saidas);
    await tx.delete(faixasDeCriancas);
    await tx.delete(pacotes);
    await tx.delete(hoteis);
    await tx.delete(destinos);
    if (dados.destinos.length) await tx.insert(destinos).values(dados.destinos);
    if (dados.hoteis.length) await tx.insert(hoteis).values(dados.hoteis);
    if (linhasDePacote.length) await tx.insert(pacotes).values(linhasDePacote);
    if (linhasDeFaixa.length) {
      await tx.insert(faixasDeCriancas).values(linhasDeFaixa);
    }
    if (dados.saidas.length) await tx.insert(saidas).values(dados.saidas);
    if (dados.periodos.length) {
      await tx
        .insert(periodosTarifarios)
        .values(dados.periodos.map(paraLinhaDePeriodo));
    }
  });
}
