import {
  type BaseDeTrechos,
  criarBaseDeTrechosEmMemoria,
  type Embedar,
  type IndiceDosTrechos,
  type TrechoIndexado,
} from "./base-de-trechos";
import { trechosDosDocumentos } from "./documentos";
import { lerVetoresGravados } from "./vetores-gravados";

/**
 * The real corpus with the production model's recorded vectors, so tests
 * search by meaning without the network (docs/adr/0006).
 */
export function trechosGravados(): {
  indice: IndiceDosTrechos;
  trechos: TrechoIndexado[];
} {
  const gravados = lerVetoresGravados();
  const trechos = trechosDosDocumentos().map((trecho) => {
    const gravado = gravados.trechos[trecho.id];
    if (gravado?.hash !== trecho.hash) {
      throw new Error(
        `Vetor gravado do Trecho ${trecho.id} desatualizado: rode pnpm embeddings:gravar`,
      );
    }
    return { ...trecho, vetor: gravado.vetor };
  });
  const { modelo, dimensoes } = gravados;
  return { indice: { modelo, dimensoes }, trechos };
}

/** The recorded vector of a question in PERGUNTAS_GRAVADAS; any other question throws, as if the network were down. */
export const embedarPerguntaGravada: Embedar = async (texto) => {
  const vetor = lerVetoresGravados().perguntas[texto];
  if (!vetor) {
    throw new Error(
      `"${texto}" não está em PERGUNTAS_GRAVADAS: acrescente e rode pnpm embeddings:gravar`,
    );
  }
  return vetor;
};

/** What criarCatalogo needs to search the texts, all in memory. */
export function buscaNosTextosDeTeste(): {
  trechos: BaseDeTrechos;
  embedarPergunta: Embedar;
} {
  const { indice, trechos } = trechosGravados();
  return {
    trechos: criarBaseDeTrechosEmMemoria(indice, trechos),
    embedarPergunta: embedarPerguntaGravada,
  };
}
