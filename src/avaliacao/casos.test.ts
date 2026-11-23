import { describe, expect, it } from "vitest";
import type { Caso } from "./caso";
import { CASOS } from "./casos";
import { conferirCasos } from "./conferir-casos";

const AGORA = "2026-12-01T09:00:00-03:00";
const casal = { adultos: 2, criancas: [] };

// gramado-serra-azul-3n on 2027-07-10 for a couple: R$ 5.780,00.
const certo: Caso = {
  id: "certo",
  categoria: "preco",
  mensagem: "…",
  esperado: {
    pacote: "gramado-serra-azul-3n",
    data: "2027-07-10",
    grupo: casal,
    total: 578000,
  },
};

/** `certo` with the expected Cotação changed. */
function comEsperado(id: string, mudanca: object): Caso {
  return { ...certo, id, esperado: { ...certo.esperado, ...mudanca } };
}

describe("conferirCasos", () => {
  it("aceita um Caso que bate com o catálogo", async () => {
    expect(await conferirCasos({ agora: AGORA, lista: [certo] })).toEqual([]);
  });

  it("reprova um Caso cujo total, Saída ou Pacote não bate com a Cotação do catálogo para o Grupo", async () => {
    const problemas = await conferirCasos({
      agora: AGORA,
      lista: [
        comEsperado("total-errado", { total: 578100 }),
        comEsperado("grupo-diferente", { grupo: { adultos: 3, criancas: [] } }),
        comEsperado("saida-inexistente", { data: "2027-07-11" }),
        comEsperado("pacote-inexistente", { pacote: "gramado-serra-azul-9n" }),
      ],
    });

    expect(problemas).toEqual([
      "total-errado: o catálogo cota gramado-serra-azul-3n em 2027-07-10 por 578000 centavos, o Caso diz 578100",
      "grupo-diferente: o catálogo cota gramado-serra-azul-3n em 2027-07-10 por 867000 centavos, o Caso diz 578000",
      expect.stringMatching(/^saida-inexistente: consultar_preco recusou/),
      expect.stringMatching(/^pacote-inexistente: consultar_preco recusou/),
    ]);
  });

  it("reprova um Caso de orçamento cuja busca não devolve a Cotação esperada", async () => {
    const problemas = await conferirCasos({
      agora: AGORA,
      lista: [
        comEsperado("fora-do-orcamento", {
          busca: { destino: "Gramado", orcamento: 500000, grupo: casal },
        }),
      ],
    });

    expect(problemas).toEqual([
      expect.stringMatching(
        /^fora-do-orcamento: a busca não devolve gramado-serra-azul-3n em 2027-07-10/,
      ),
    ]);
  });

  it('reprova um Caso de "nenhum Pacote serve" cuja busca devolve Cotações', async () => {
    const problemas = await conferirCasos({
      agora: AGORA,
      lista: [
        {
          ...certo,
          id: "algum-serve",
          esperado: {
            nenhumPacote: true,
            busca: {
              destino: "Bonito",
              janela: { inicio: "2027-03-01", fim: "2027-03-31" },
              orcamento: 520000,
              grupo: casal,
            },
          },
        },
      ],
    });

    expect(problemas).toEqual([
      "algum-serve: esperava nenhum Pacote, a busca devolve bonito-aguas-cristalinas-3n em 2027-03-06",
    ]);
  });

  it("reprova ids repetidos", async () => {
    expect(
      await conferirCasos({ agora: AGORA, lista: [certo, certo] }),
    ).toEqual(["certo: id repetido"]);
  });

  it("os 15 Casos de preço batem com o catálogo na data fixa", async () => {
    expect(CASOS.lista.filter((c) => c.categoria === "preco")).toHaveLength(15);
    expect(await conferirCasos(CASOS)).toEqual([]);
  });
});
