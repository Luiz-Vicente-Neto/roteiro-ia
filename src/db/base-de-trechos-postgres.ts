// Postgres implementation of the Base de Trechos (docs/adr/0005), with pgvector.
import { asc, cosineDistance, desc, sql } from "drizzle-orm";
import {
  type BaseDeTrechos,
  conferirVetores,
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
    secao: linha.secao,
    textoCitado: linha.textoCitado,
  };
}

export function criarBaseDeTrechosPostgres(db: Db): BaseDeTrechos {
  return {
    async buscarPorSentido(vetor, limite) {
      const linhas = await db
        .select()
        .from(trechos)
        .orderBy(asc(cosineDistance(trechos.vetor, vetor)), asc(trechos.id))
        .limit(limite);
      return linhas.map(paraTrecho);
    },
    async buscarPorPalavras(texto, limite) {
      // plainto_tsquery requires every word (AND); a Trecho with any of
      // them should come back, so the ANDs become ORs. Cast, not to_tsquery,
      // so the lexemes are not stemmed a second time.
      const consulta = sql`replace(plainto_tsquery('pt_unaccent', ${texto})::text, ' & ', ' | ')::tsquery`;
      const linhas = await db
        .select()
        .from(trechos)
        .where(sql`${trechos.palavras} @@ ${consulta}`)
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
