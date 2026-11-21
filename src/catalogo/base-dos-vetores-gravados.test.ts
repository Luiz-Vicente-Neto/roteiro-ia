import { describe, expect, it } from "vitest";
import {
  baseDosVetoresGravados,
  ESCOPO_GERAL,
  type Trecho,
  type VetoresGravados,
} from ".";

const trecho = (
  id: string,
  hash: string,
  texto = `Texto de ${id}.`,
): Trecho => ({
  id,
  documento: { id: "politica-da-agencia", titulo: "Política da Agência" },
  tipoDoDocumento: "politica-da-agencia",
  secao: id,
  textoCitado: texto,
  textoEmbedado: `Política da Agência › ${id}\n\n${texto}`,
  hash,
});

const gravados: VetoresGravados = {
  modelo: "google:gemini-embedding-2",
  dimensoes: 3,
  trechos: {
    a: { hash: "hash-a", vetor: [1, 0, 0] },
    b: { hash: "hash-b", vetor: [0, 1, 0] },
  },
  perguntas: {},
};

const ids = (trechos: { id: string }[]) => trechos.map((t) => t.id);

describe("baseDosVetoresGravados", () => {
  it("busca por sentido com os vetores gravados, no índice deles", async () => {
    const { base, indice, desatualizados, semVetor } = baseDosVetoresGravados(
      [trecho("a", "hash-a"), trecho("b", "hash-b")],
      gravados,
    );

    expect(
      ids(await base.buscarPorSentido([0, 1, 0], 2, ESCOPO_GERAL)),
    ).toEqual(["b", "a"]);
    expect(indice).toEqual({
      modelo: "google:gemini-embedding-2",
      dimensoes: 3,
    });
    expect(desatualizados).toEqual([]);
    expect(semVetor).toEqual([]);
  });

  it("um Trecho cujo texto mudou busca com o vetor antigo e sai marcado como desatualizado", async () => {
    const { base, desatualizados } = baseDosVetoresGravados(
      [trecho("a", "hash-a"), trecho("b", "hash-novo", "Texto novo.")],
      gravados,
    );

    expect(
      ids(await base.buscarPorSentido([0, 1, 0], 1, ESCOPO_GERAL)),
    ).toEqual(["b"]);
    expect(ids(await base.buscarPorPalavras("novo", 5, ESCOPO_GERAL))).toEqual([
      "b",
    ]);
    expect(desatualizados).toEqual(["b"]);
  });

  it("um Trecho sem vetor gravado só entra na busca por palavras, e sai marcado", async () => {
    const { base, semVetor } = baseDosVetoresGravados(
      [trecho("a", "hash-a"), trecho("c", "hash-c", "Texto recente.")],
      gravados,
    );

    expect(
      ids(await base.buscarPorSentido([1, 0, 0], 5, ESCOPO_GERAL)),
    ).toEqual(["a"]);
    expect(
      ids(await base.buscarPorPalavras("recente", 5, ESCOPO_GERAL)),
    ).toEqual(["c"]);
    expect(semVetor).toEqual(["c"]);
  });
});
