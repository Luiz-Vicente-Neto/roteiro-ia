import {
  conferirIndiceDosTrechos,
  criarBaseDeTrechosEmMemoria,
  criarBaseEmMemoria,
  criarCatalogo,
  type Embedar,
  type IndiceDosTrechos,
  indexarTrechos,
  lerVetoresGravados,
  type Relogio,
  semente,
  trechosDosDocumentos,
} from "../catalogo";
import { trechosMaliciosos } from "./documentos-maliciosos";

/**
 * The Trechos of the Documentos, plus the Avaliação's Documentos maliciosos,
 * with their recorded vectors (docs/adr/0006), in memory. A Trecho changed
 * since the recording throws instead of being embedded: the Avaliação
 * measures the vectors the demo has.
 */
async function trechosGravados() {
  const gravados = lerVetoresGravados();
  const indice = { modelo: gravados.modelo, dimensoes: gravados.dimensoes };
  const trechos = await indexarTrechos({
    trechos: [...trechosDosDocumentos(), ...trechosMaliciosos()],
    gravados,
    indice,
    embedarTrechos: async () => {
      throw new Error(
        "Há Trechos sem vetor gravado ou desatualizados: rode pnpm embeddings:gravar",
      );
    },
  });
  return { base: criarBaseDeTrechosEmMemoria(indice, trechos), trechos };
}

/**
 * Builds a fresh catalog from `semente.ts` and the Documentos maliciosos,
 * in memory, for each Caso: the Trechos keep their recorded vectors, and only the question the model sends
 * to buscar_politicas goes to `embedarPergunta`, since the model rewrites it.
 * `trechos` are the id and hash of every Trecho the search sees.
 */
export async function fabricaDeCatalogos({
  embeddings: { indice, embedarPergunta },
  relogio,
}: {
  /** `indice` must be the model of the recorded vectors: vectors of two models never compare. */
  embeddings: { indice: IndiceDosTrechos; embedarPergunta: Embedar };
  relogio: Relogio;
}) {
  const { base, trechos } = await trechosGravados();
  await conferirIndiceDosTrechos(base, indice);
  return {
    novoCatalogo: () =>
      criarCatalogo({
        base: criarBaseEmMemoria(semente),
        trechos: base,
        embedarPergunta,
        relogio,
      }),
    trechos: trechos.map(({ id, hash }) => ({ id, hash })),
  };
}
