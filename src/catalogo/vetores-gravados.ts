// The recorded vectors (docs/adr/0006): the tests search with the production
// model's real vectors without the network, and `pnpm db:setup` needs no key.
// `pnpm embeddings:gravar` rewrites the file; semente.test.ts fails when it is
// out of date.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  conferirVetores,
  type IndiceDosTrechos,
  type TrechoIndexado,
} from "./base-de-trechos";
import type { Trecho } from "./tipos";

// A function for the same reason as in documentos.ts.
const arquivo = () => join(import.meta.dirname, "vetores-gravados.json");

/** The questions the tests search with, recorded with the Trechos. */
export const PERGUNTAS_GRAVADAS = [
  "posso cancelar?",
  "como posso pagar?",
  "preciso de passaporte?",
  "meu cachorro pode ir?",
  "o que diz o Estatuto?",
] as const;

export interface VetoresGravados extends IndiceDosTrechos {
  /** By Trecho id: the hash of the text it was embedded from, and its vector. */
  trechos: Record<string, { hash: string; vetor: number[] }>;
  perguntas: Record<string, number[]>;
}

export function lerVetoresGravados(): VetoresGravados {
  return JSON.parse(readFileSync(arquivo(), "utf8"));
}

/** One vector per line, so a changed Trecho shows as one changed line in the PR. */
export function gravarVetores(vetores: VetoresGravados): void {
  const linhas = (registro: Record<string, unknown>) =>
    Object.entries(registro)
      .map(
        ([chave, valor]) =>
          `    ${JSON.stringify(chave)}: ${JSON.stringify(valor)}`,
      )
      .join(",\n");
  const conteudo = [
    "{",
    `  "modelo": ${JSON.stringify(vetores.modelo)},`,
    `  "dimensoes": ${vetores.dimensoes},`,
    `  "trechos": {\n${linhas(vetores.trechos)}\n  },`,
    `  "perguntas": {\n${linhas(vetores.perguntas)}\n  }`,
    "}",
    "",
  ].join("\n");
  writeFileSync(arquivo(), conteudo);
}

/**
 * The Trechos with their vectors: the recorded one when it came from the
 * model of `indice` and from the Trecho's current text, a fresh one from
 * `embedarTrechos` otherwise. It is called only for those, so a seed with an
 * up-to-date file needs neither key nor network.
 */
export async function indexarTrechos({
  trechos,
  gravados,
  indice,
  embedarTrechos,
}: {
  trechos: Trecho[];
  gravados: VetoresGravados;
  indice: IndiceDosTrechos;
  embedarTrechos: (textos: string[]) => Promise<number[][]>;
}): Promise<TrechoIndexado[]> {
  const mesmoModelo =
    gravados.modelo === indice.modelo &&
    gravados.dimensoes === indice.dimensoes;
  const gravadoDe = (trecho: Trecho) => {
    const gravado = mesmoModelo ? gravados.trechos[trecho.id] : undefined;
    return gravado?.hash === trecho.hash ? gravado.vetor : undefined;
  };
  const semVetor = trechos.filter((t) => !gravadoDe(t));
  const novos =
    semVetor.length > 0
      ? await embedarTrechos(semVetor.map((t) => t.textoEmbedado))
      : [];
  const vetorNovo = new Map(semVetor.map((t, i) => [t.id, novos[i] ?? []]));
  const indexados = trechos.map((trecho) => ({
    ...trecho,
    vetor: gravadoDe(trecho) ?? vetorNovo.get(trecho.id) ?? [],
  }));
  conferirVetores(indice, indexados);
  return indexados;
}
