// Postgres implementation of the Base de Trechos (docs/adr/0005), with pgvector.
import {
  and,
  asc,
  cosineDistance,
  desc,
  inArray,
  isNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import {
  type BaseDeTrechos,
  conferirVetores,
  type EscopoDaBusca,
  type IndiceDosTrechos,
  type TipoDeDocumento,
  type TrechoEncontrado,
  type TrechoIndexado,
} from "../catalogo";
import type { Db } from "./client";
import { trechos } from "./schema";

function paraTrecho(linha: typeof trechos.$inferSelect): TrechoEncontrado {
  return {
    id: linha.id,
    documento: { id: linha.documentoId, titulo: linha.documentoTitulo },
    tipoDoDocumento: linha.tipoDoDocumento as TipoDeDocumento,
    ...(linha.destino !== null && { destino: linha.destino }),
    ...(linha.hotel !== null && { hotel: linha.hotel }),
    secao: linha.secao,
    textoCitado: linha.textoCitado,
  };
}

/** The rows a search in `escopo` may return; the same rule as estaNoEscopo. */
function noEscopo({ destinos, hoteis }: EscopoDaBusca): SQL | undefined {
  // inArray with an empty list is false, so an empty escopo keeps only the
  // Trechos of no Destino nor Hotel.
  return or(
    and(
      isNull(trechos.hotel),
      or(isNull(trechos.destino), inArray(trechos.destino, destinos)),
    ),
    inArray(trechos.hotel, hoteis),
  );
}

export function criarBaseDeTrechosPostgres(db: Db): BaseDeTrechos {
  return {
    async buscarPorSentido(vetor, limite, escopo) {
      const linhas = await db
        .select()
        .from(trechos)
        .where(noEscopo(escopo))
        .orderBy(asc(cosineDistance(trechos.vetor, vetor)), asc(trechos.id))
        .limit(limite);
      return linhas.map(paraTrecho);
    },
    async buscarPorPalavras(texto, limite, escopo) {
      // plainto_tsquery requires every word (AND); a Trecho with any of
      // them should come back, so the ANDs become ORs. Cast, not to_tsquery,
      // so the lexemes are not stemmed a second time.
      const consulta = sql`replace(plainto_tsquery('pt_unaccent', ${texto})::text, ' & ', ' | ')::tsquery`;
      const linhas = await db
        .select()
        .from(trechos)
        .where(and(sql`${trechos.palavras} @@ ${consulta}`, noEscopo(escopo)))
        .orderBy(
          desc(sql`ts_rank(${trechos.palavras}, ${consulta})`),
          asc(trechos.id),
        )
        .limit(limite);
      return linhas.map(paraTrecho);
    },
    async lerIndice() {
      const indices = await db
        .selectDistinct({
          modelo: trechos.modelo,
          dimensoes: sql<number>`vector_dims(${trechos.vetor})`,
        })
        .from(trechos);
      // substituirTrechos writes every row with one model, so more than one is a bug.
      if (indices.length > 1) {
        throw new Error(
          `A tabela trechos mistura modelos: ${indices.map((i) => i.modelo).join(", ")}`,
        );
      }
      return indices[0];
    },
  };
}

/** Replaces every stored Trecho with `lista`, all indexed with `indice`. */
export async function substituirTrechos(
  db: Db,
  indice: IndiceDosTrechos,
  lista: TrechoIndexado[],
): Promise<void> {
  conferirVetores(indice, lista);
  await db.transaction(async (tx) => {
    await tx.delete(trechos);
    if (lista.length === 0) return;
    await tx.insert(trechos).values(
      lista.map((t) => ({
        id: t.id,
        documentoId: t.documento.id,
        documentoTitulo: t.documento.titulo,
        tipoDoDocumento: t.tipoDoDocumento,
        destino: t.destino ?? null,
        hotel: t.hotel ?? null,
        secao: t.secao,
        textoCitado: t.textoCitado,
        textoEmbedado: t.textoEmbedado,
        hash: t.hash,
        modelo: indice.modelo,
        vetor: t.vetor,
      })),
    );
  });
}
