import { expect, it } from "vitest";
import { criarBaseEmMemoria } from "./base";
import { testarContratoDaBase } from "./base.contrato";

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
