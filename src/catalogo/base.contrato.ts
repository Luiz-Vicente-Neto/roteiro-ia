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
      precoBase: 389000,
    },
    {
      slug: "campos-chateau-montanha-2n",
      nome: "Fim de Semana na Serra",
      hotel: "chateau-montanha",
      noites: 2,
      inclui: ["Café da manhã", "Fondue"],
      precoBase: 112300,
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
  // Same start date and same name across Destinos, so every sort key counts.
  periodos: [
    {
      nome: "Alta de Verão",
      tipo: "temporada",
      destino: "jericoacoara",
      inicio: "2027-12-15",
      fim: "2028-02-28",
      fator: 1.45,
    },
    {
      nome: "Natal",
      tipo: "feriado",
      inicio: "2027-12-20",
      fim: "2027-12-27",
      fator: 1.3,
    },
    {
      nome: "Alta de Verão",
      tipo: "temporada",
      destino: "campos-do-jordao",
      inicio: "2027-12-15",
      fim: "2028-01-31",
      fator: 1.05,
    },
    {
      nome: "Alta de Inverno",
      tipo: "temporada",
      destino: "campos-do-jordao",
      inicio: "2027-12-15",
      fim: "2027-12-31",
      fator: 2,
    },
    {
      nome: "Alta de Verão",
      tipo: "feriado",
      inicio: "2027-12-15",
      fim: "2027-12-16",
      fator: 1.01,
    },
  ],
};

/** The same cases run against every Base do Catálogo implementation. */
export function testarContratoDaBase(nome: string, criarBase: CriarBase) {
  describe(`Base do Catálogo (${nome})`, () => {
    it("lê de volta exatamente o catálogo carregado, ordenado por slug, as Saídas por Pacote e data, e os Períodos por início, nome e Destino", async () => {
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
        periodos: [
          dados.periodos[3],
          dados.periodos[4],
          dados.periodos[2],
          dados.periodos[0],
          dados.periodos[1],
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
        periodos: [],
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
        periodos: [],
      });

      expect(await base.lerCatalogo()).toEqual({
        destinos: [],
        hoteis: [],
        pacotes: [],
        saidas: [],
        periodos: [],
      });
    });
  });
}
