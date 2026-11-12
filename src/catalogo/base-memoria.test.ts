import { describe, expect, it } from "vitest";
import { criarBaseEmMemoria } from "./base";
import { testarContratoDaBase } from "./base.contrato";
import type { DadosDoCatalogo, FaixaDeIdade } from "./tipos";

testarContratoDaBase("memória", async (dados) => criarBaseEmMemoria(dados));

it("recusa um fator com mais de duas casas decimais, que o Postgres arredondaria", () => {
  expect(() =>
    criarBaseEmMemoria({
      destinos: [],
      hoteis: [],
      pacotes: [],
      saidas: [],
      periodos: [
        {
          nome: "Natal",
          tipo: "feriado",
          inicio: "2027-12-20",
          fim: "2027-12-27",
          fator: 1.355,
        },
      ],
    }),
  ).toThrow(/1.355/);
});

describe("recusa uma Política de Crianças que não dá um único percentual a cada idade de 0 a 11", () => {
  const comFaixas = (faixas: FaixaDeIdade[]): DadosDoCatalogo => ({
    destinos: [{ slug: "gramado", nome: "Gramado" }],
    hoteis: [
      {
        slug: "serra-azul",
        nome: "Hotel Serra Azul",
        destino: "gramado",
        aceitaPet: false,
      },
    ],
    pacotes: [
      {
        slug: "gramado-serra-azul-3n",
        nome: "Gramado Essencial",
        hotel: "serra-azul",
        noites: 3,
        inclui: [],
        precoBase: 214100,
        politicaDeCriancas: { aceitaCriancas: true, faixas },
      },
    ],
    saidas: [],
    periodos: [],
  });

  it.each([
    {
      caso: "uma idade sem faixa",
      faixas: [
        { idadeMinima: 0, idadeMaxima: 5, percentual: 0 },
        { idadeMinima: 7, idadeMaxima: 11, percentual: 50 },
      ],
    },
    {
      caso: "faixas sobrepostas",
      faixas: [
        { idadeMinima: 0, idadeMaxima: 6, percentual: 0 },
        { idadeMinima: 6, idadeMaxima: 11, percentual: 50 },
      ],
    },
    {
      caso: "faixa além de 11 anos",
      faixas: [{ idadeMinima: 0, idadeMaxima: 12, percentual: 50 }],
    },
    {
      caso: "faixa invertida",
      faixas: [
        { idadeMinima: 0, idadeMaxima: 11, percentual: 50 },
        { idadeMinima: 5, idadeMaxima: 4, percentual: 50 },
      ],
    },
    { caso: "nenhuma faixa", faixas: [] },
    {
      caso: "percentual acima de 100",
      faixas: [{ idadeMinima: 0, idadeMaxima: 11, percentual: 101 }],
    },
    {
      caso: "percentual fracionado",
      faixas: [{ idadeMinima: 0, idadeMaxima: 11, percentual: 37.5 }],
    },
  ])("($caso)", ({ faixas }) => {
    expect(() => criarBaseEmMemoria(comFaixas(faixas))).toThrow(
      /gramado-serra-azul-3n/,
    );
  });
});
