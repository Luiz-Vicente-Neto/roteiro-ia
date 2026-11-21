import { describe, expect, it } from "vitest";
import { indexarTrechos, type Trecho, type VetoresGravados } from ".";

const trecho = (id: string, hash: string): Trecho => ({
  id,
  documento: { id: "politica-da-agencia", titulo: "Política da Agência" },
  tipoDoDocumento: "politica-da-agencia",
  secao: id,
  textoCitado: `Texto de ${id}.`,
  textoEmbedado: `Política da Agência › ${id}\n\nTexto de ${id}.`,
  hash,
});

const trechos = [trecho("a", "hash-a"), trecho("b", "hash-b")];

const gravados: VetoresGravados = {
  modelo: "google:gemini-embedding-2",
  dimensoes: 3,
  trechos: {
    a: { hash: "hash-a", vetor: [1, 0, 0] },
    b: { hash: "hash-b", vetor: [0, 1, 0] },
  },
  perguntas: {},
};

/** Embeds every text as [length, 0, 0], recording what it was asked. */
function embeddingFalso() {
  const pedidos: string[][] = [];
  return {
    pedidos,
    async embedarTrechos(textos: string[]) {
      pedidos.push(textos);
      return textos.map((t) => [t.length, 0, 0]);
    },
  };
}

describe("indexarTrechos", () => {
  it("usa os vetores gravados, sem chamar o embedding, quando o modelo e os hashes batem", async () => {
    const falso = embeddingFalso();

    const indexados = await indexarTrechos({
      trechos,
      gravados,
      indice: { modelo: "google:gemini-embedding-2", dimensoes: 3 },
      embedarTrechos: falso.embedarTrechos,
    });

    expect(indexados.map((t) => [t.id, t.vetor])).toEqual([
      ["a", [1, 0, 0]],
      ["b", [0, 1, 0]],
    ]);
    expect(falso.pedidos).toEqual([]);
  });

  it("gera na hora o vetor de um Trecho cujo texto mudou desde a gravação", async () => {
    const falso = embeddingFalso();
    const mudado = trecho("b", "hash-novo");

    const indexados = await indexarTrechos({
      trechos: [trechos[0], mudado],
      gravados,
      indice: { modelo: "google:gemini-embedding-2", dimensoes: 3 },
      embedarTrechos: falso.embedarTrechos,
    });

    expect(falso.pedidos).toEqual([[mudado.textoEmbedado]]);
    expect(indexados.map((t) => t.vetor)).toEqual([
      [1, 0, 0],
      [mudado.textoEmbedado.length, 0, 0],
    ]);
  });

  it("gera todos os vetores na hora quando o .env usa outro modelo", async () => {
    const falso = embeddingFalso();

    const indexados = await indexarTrechos({
      trechos,
      gravados,
      indice: { modelo: "openai:text-embedding-3-large", dimensoes: 3 },
      embedarTrechos: falso.embedarTrechos,
    });

    expect(falso.pedidos).toEqual([trechos.map((t) => t.textoEmbedado)]);
    expect(indexados.map((t) => t.vetor)).toEqual(
      trechos.map((t) => [t.textoEmbedado.length, 0, 0]),
    );
  });

  it("recusa um vetor gerado com dimensão diferente da do índice", async () => {
    await expect(
      indexarTrechos({
        trechos,
        gravados,
        indice: { modelo: "openai:text-embedding-3-large", dimensoes: 768 },
        embedarTrechos: embeddingFalso().embedarTrechos,
      }),
    ).rejects.toThrow(/768/);
  });
});
