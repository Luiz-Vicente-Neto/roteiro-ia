import { describe, expect, it } from "vitest";
import type { BaseDoCatalogo } from "./base";
import type { DadosDoCatalogo } from "./tipos";

/** Builds a Base do Catálogo holding exactly `dados`, empty of anything else. */
export type CriarBase = (dados: DadosDoCatalogo) => Promise<BaseDoCatalogo>;

// Given out of order on purpose, and with edge cases a storage round trip
// could break: accents, an empty `inclui`, dates at month and year turns.
const dados: DadosDoCatalogo = {
  destinos: [
    { slug: "jericoacoara", nome: "Jericoacoara" },
    { slug: "campos-do-jordao", nome: "Campos do Jordão" },
  ],
  hoteis: [
    {
      slug: "vila-kalango",
      nome: "Vila Kalango",
      destino: "jericoacoara",
      aceitaPet: true,
    },
    {
      slug: "chateau-montanha",
      nome: "Château da Montanha",
      destino: "campos-do-jordao",
      aceitaPet: false,
    },
  ],
  pacotes: [
    {
      slug: "jericoacoara-vila-kalango-7n",
      nome: "Jeri Pé na Areia",
      hotel: "vila-kalango",
      noites: 7,
      inclui: [],
    },
    {
      slug: "campos-chateau-montanha-2n",
      nome: "Fim de Semana na Serra",
      hotel: "chateau-montanha",
      noites: 2,
      inclui: ["Café da manhã", "Fondue"],
    },
  ],
  saidas: [
    {
      pacote: "jericoacoara-vila-kalango-7n",
      data: "2028-01-01",
      vagasTotais: 0,
    },
    {
      pacote: "campos-chateau-montanha-2n",
      data: "2027-12-31",
      vagasTotais: 30,
    },
    {
      pacote: "jericoacoara-vila-kalango-7n",
      data: "2027-12-31",
      vagasTotais: 4,
    },
    {
      pacote: "campos-chateau-montanha-2n",
      data: "2027-03-01",
      vagasTotais: 1,
    },
  ],
};

/** The same cases run against every Base do Catálogo implementation. */
export function testarContratoDaBase(nome: string, criarBase: CriarBase) {
  describe(`Base do Catálogo (${nome})`, () => {
    it("lê de volta exatamente o catálogo carregado, ordenado por slug e as Saídas por Pacote e data", async () => {
      const base = await criarBase(dados);

      expect(await base.lerCatalogo()).toEqual({
        destinos: [dados.destinos[1], dados.destinos[0]],
        hoteis: [dados.hoteis[1], dados.hoteis[0]],
        pacotes: [dados.pacotes[1], dados.pacotes[0]],
        saidas: [
          dados.saidas[3],
          dados.saidas[1],
          dados.saidas[2],
          dados.saidas[0],
        ],
      });
    });

    it("ordena slugs pelos caracteres, com o hífen antes das letras, igual em toda implementação", async () => {
      // Locale-aware collations ignore the hyphen and would put casarao first.
      const base = await criarBase({
        destinos: [{ slug: "gramado", nome: "Gramado" }],
        hoteis: [
          {
            slug: "casarao",
            nome: "Casarão",
            destino: "gramado",
            aceitaPet: false,
          },
          {
            slug: "casa-zen",
            nome: "Casa Zen",
            destino: "gramado",
            aceitaPet: false,
          },
        ],
        pacotes: [],
        saidas: [],
      });

      const { hoteis } = await base.lerCatalogo();

      expect(hoteis.map((h) => h.slug)).toEqual(["casa-zen", "casarao"]);
    });

    it("lê um catálogo vazio", async () => {
      const base = await criarBase({
        destinos: [],
        hoteis: [],
        pacotes: [],
        saidas: [],
      });

      expect(await base.lerCatalogo()).toEqual({
        destinos: [],
        hoteis: [],
        pacotes: [],
        saidas: [],
      });
    });
  });
}
