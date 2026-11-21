import type { Trecho } from "./tipos";

/** Turns a text into its vector. Injected, so the module never imports the AI SDK (docs/adr/0006). */
export type Embedar = (texto: string) => Promise<number[]>;

/** The embedding model the vectors came from: vectors of different models never compare. */
export interface IndiceDosTrechos {
  /** `provedor:modelo`, as in EMBEDDINGS. */
  modelo: string;
  dimensoes: number;
}

/** A Trecho with its vector, as a Base de Trechos stores it. */
export type TrechoIndexado = Trecho & { vetor: number[] };

/** A Trecho the search found, without what only the search needs. */
export type TrechoEncontrado = Omit<Trecho, "textoEmbedado" | "hash">;

/**
 * Base de Trechos: what the text search needs from storage (docs/adr/0005).
 * Separate from the Base do Catálogo because its implementations need not
 * rank alike: the contract checks properties, never the exact order.
 */
export interface BaseDeTrechos {
  /** Up to `limite` Trechos, most similar to `vetor` by cosine first. */
  buscarPorSentido(
    vetor: number[],
    limite: number,
  ): Promise<TrechoEncontrado[]>;
  /**
   * Up to `limite` Trechos holding words of `texto`, best match first. Accents
   * and case never matter, and stopwords never match; a Trecho with none of
   * the words never comes back. Postgres also matches by stem, the in-memory
   * Base only whole words.
   */
  buscarPorPalavras(texto: string, limite: number): Promise<TrechoEncontrado[]>;
  /** The model and dimensions the stored vectors came from, or undefined when no Trecho is stored. */
  lerIndice(): Promise<IndiceDosTrechos | undefined>;
}

/** Throws when a vector cannot be compared with the others in the index. */
export function conferirVetores(
  indice: IndiceDosTrechos,
  trechos: TrechoIndexado[],
): void {
  for (const { id, vetor } of trechos) {
    if (vetor.length !== indice.dimensoes) {
      throw new Error(
        `O vetor do Trecho ${id} tem ${vetor.length} dimensões, e o índice ${indice.modelo} tem ${indice.dimensoes}.`,
      );
    }
  }
}

function cosseno(a: number[], b: number[]): number {
  let produto = 0;
  let normaA = 0;
  let normaB = 0;
  for (let i = 0; i < a.length; i++) {
    produto += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }
  return produto / Math.sqrt(normaA * normaB);
}

// Words too common to tell Trechos apart. A short hand-picked list, not
// Postgres's `portuguese` one: the in-memory search only has to be simple.
const PALAVRAS_VAZIAS = new Set([
  "a",
  "o",
  "as",
  "os",
  "e",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "um",
  "uma",
  "uns",
  "umas",
  "num",
  "numa",
  "ao",
  "aos",
  "que",
  "com",
  "por",
  "para",
  "pelo",
  "pela",
  "pelos",
  "pelas",
  "se",
  "mas",
  "ou",
  "como",
  "mais",
  "seu",
  "sua",
  "seus",
  "suas",
  "meu",
  "minha",
  "meus",
  "minhas",
  "ele",
  "ela",
  "eles",
  "elas",
  "isso",
  "isto",
  "esse",
  "essa",
  "este",
  "esta",
  "qual",
  "quando",
  "onde",
  "sem",
  "nao",
  "tem",
  "ser",
  "sao",
  "foi",
  "ate",
  "entre",
  "tambem",
  "muito",
  "ja",
  "so",
]);

/** The words of `texto` that count, lowercase and without accents, repeats kept. */
function palavras(texto: string): string[] {
  const todas = texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u);
  // One letter alone ("é" once unaccented) never tells Trechos apart.
  return todas.filter((p) => p.length > 1 && !PALAVRAS_VAZIAS.has(p));
}

function semVetor({
  id,
  documento,
  tipoDoDocumento,
  secao,
  textoCitado,
}: TrechoIndexado): TrechoEncontrado {
  return structuredClone({
    id,
    documento,
    tipoDoDocumento,
    secao,
    textoCitado,
  });
}

export function criarBaseDeTrechosEmMemoria(
  indice: IndiceDosTrechos,
  trechos: TrechoIndexado[],
): BaseDeTrechos {
  conferirVetores(indice, trechos);
  // Copied on the way in, so no caller can change the stored Trechos.
  const guardados = structuredClone(trechos);
  return {
    async buscarPorSentido(vetor, limite) {
      return guardados
        .map((trecho) => ({
          trecho,
          similaridade: cosseno(vetor, trecho.vetor),
        }))
        .sort((a, b) => b.similaridade - a.similaridade)
        .slice(0, limite)
        .map(({ trecho }) => semVetor(trecho));
    },
    async buscarPorPalavras(texto, limite) {
      const procuradas = new Set(palavras(texto));
      return guardados
        .map((trecho) => {
          const achadas = palavras(trecho.textoEmbedado).filter((p) =>
            procuradas.has(p),
          );
          return {
            trecho,
            // Distinct words found first, then how often they appear.
            distintas: new Set(achadas).size,
            vezes: achadas.length,
          };
        })
        .filter(({ distintas }) => distintas > 0)
        .sort(
          (a, b) =>
            b.distintas - a.distintas ||
            b.vezes - a.vezes ||
            a.trecho.id.localeCompare(b.trecho.id),
        )
        .slice(0, limite)
        .map(({ trecho }) => semVetor(trecho));
    },
    async lerIndice() {
      return guardados.length > 0 ? { ...indice } : undefined;
    },
  };
}

/**
 * Throws unless `base` was indexed with the model and dimensions of
 * `esperado`, the ones the questions are embedded with: vectors of different
 * models never compare. The server runs it before taking any request.
 */
export async function conferirIndiceDosTrechos(
  base: BaseDeTrechos,
  esperado: IndiceDosTrechos,
): Promise<void> {
  const gravado = await base.lerIndice();
  if (!gravado) {
    throw new Error(
      "A Base de Trechos está vazia, e buscar_politicas não teria onde buscar. Rode pnpm db:setup.",
    );
  }
  if (
    gravado.modelo !== esperado.modelo ||
    gravado.dimensoes !== esperado.dimensoes
  ) {
    throw new Error(
      `A Base de Trechos foi indexada com ${gravado.modelo} (${gravado.dimensoes} dimensões), mas EMBEDDINGS pede ${esperado.modelo} (${esperado.dimensoes} dimensões). Vetores de modelos diferentes não se comparam: rode pnpm db:setup para indexar de novo.`,
    );
  }
}
