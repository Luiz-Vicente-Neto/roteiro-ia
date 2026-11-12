import { describe, expect, it } from "vitest";
import type { BaseDoCatalogo } from "./base";
import { semente } from "./semente";
import type { DadosDoCatalogo, Proposta } from "./tipos";

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
      politicaDeCriancas: { aceitaCriancas: false },
    },
    {
      slug: "campos-chateau-montanha-2n",
      nome: "Fim de Semana na Serra",
      hotel: "chateau-montanha",
      noites: 2,
      inclui: ["Café da manhã", "Fondue"],
      precoBase: 112300,
      // Faixas out of order, and single-age ones at both ends.
      politicaDeCriancas: {
        aceitaCriancas: true,
        faixas: [
          { idadeMinima: 1, idadeMaxima: 10, percentual: 35 },
          { idadeMinima: 11, idadeMaxima: 11, percentual: 100 },
          { idadeMinima: 0, idadeMaxima: 0, percentual: 0 },
        ],
      },
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
    it("lê de volta exatamente o catálogo carregado, ordenado por slug, as faixas da Política de Crianças por idade, as Saídas por Pacote e data, e os Períodos por início, nome e Destino", async () => {
      const base = await criarBase(dados);

      expect(await base.lerCatalogo()).toEqual({
        destinos: [dados.destinos[1], dados.destinos[0]],
        hoteis: [dados.hoteis[1], dados.hoteis[0]],
        pacotes: [
          {
            ...dados.pacotes[1],
            politicaDeCriancas: {
              aceitaCriancas: true,
              faixas: [
                { idadeMinima: 0, idadeMaxima: 0, percentual: 0 },
                { idadeMinima: 1, idadeMaxima: 10, percentual: 35 },
                { idadeMinima: 11, idadeMaxima: 11, percentual: 100 },
              ],
            },
          },
          dados.pacotes[0],
        ],
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

    it("recusa uma Política de Crianças com uma idade sem faixa, que ficaria sem preço", async () => {
      const [, pacote] = dados.pacotes;
      await expect(
        criarBase({
          ...dados,
          pacotes: [
            {
              ...pacote,
              politicaDeCriancas: {
                aceitaCriancas: true,
                faixas: [{ idadeMinima: 0, idadeMaxima: 10, percentual: 0 }],
              },
            },
          ],
          saidas: [],
        }),
      ).rejects.toThrow(/campos-chateau-montanha-2n/);
    });

    it("carregada com a semente, enxerga o catálogo completo: as mesmas contagens e os mesmos dados numa amostra", async () => {
      const base = await criarBase(semente);

      const catalogo = await base.lerCatalogo();

      const contagens = (dados: DadosDoCatalogo) => ({
        destinos: dados.destinos.length,
        hoteis: dados.hoteis.length,
        pacotes: dados.pacotes.length,
        saidas: dados.saidas.length,
        periodos: dados.periodos.length,
      });
      expect(contagens(catalogo)).toEqual(contagens(semente));
      const amostra = {
        destino: semente.destinos.find((d) => d.slug === "lencois-maranhenses"),
        hotelComPet: semente.hoteis.find((h) => h.aceitaPet),
        pacoteSemCriancas: semente.pacotes.find(
          (p) => !p.politicaDeCriancas.aceitaCriancas,
        ),
        pacoteComFaixas: semente.pacotes.find(
          (p) => p.politicaDeCriancas.aceitaCriancas,
        ),
        saidaComPoucasVagas: semente.saidas.find((s) => s.vagasTotais === 1),
        ultimaSaida: semente.saidas.at(-1),
        feriado: semente.periodos.find((p) => p.nome === "Carnaval"),
        temporada: semente.periodos.find(
          (p) => p.nome === "Festival de Inverno",
        ),
      };
      // A sample the seed no longer has would compare against undefined.
      expect(
        Object.entries(amostra).filter(([, valor]) => valor === undefined),
      ).toEqual([]);
      expect(catalogo.destinos).toContainEqual(amostra.destino);
      expect(catalogo.hoteis).toContainEqual(amostra.hotelComPet);
      expect(catalogo.pacotes).toContainEqual(amostra.pacoteSemCriancas);
      expect(catalogo.pacotes).toContainEqual(amostra.pacoteComFaixas);
      expect(catalogo.saidas).toContainEqual(amostra.saidaComPoucasVagas);
      expect(catalogo.saidas).toContainEqual(amostra.ultimaSaida);
      expect(catalogo.periodos).toContainEqual(amostra.feriado);
      expect(catalogo.periodos).toContainEqual(amostra.temporada);
    });

    it("grava uma Proposta e a lê de volta pelo id, com o Grupo na ordem dada e os instantes exatos", async () => {
      const base = await criarBase(dados);
      const comCriancas: Proposta = {
        id: "a1".repeat(32),
        pacote: "campos-chateau-montanha-2n",
        data: "2027-12-31",
        grupo: { adultos: 2, criancas: [9, 0, 11] },
        total: 448900,
        criadaEm: new Date("2026-12-01T12:00:00.123Z"),
        expiraEm: new Date("2026-12-01T12:15:00.123Z"),
      };
      const semCriancas: Proposta = {
        id: "b2".repeat(32),
        pacote: "jericoacoara-vila-kalango-7n",
        data: "2027-12-31",
        grupo: { adultos: 1, criancas: [] },
        total: 564100,
        criadaEm: new Date("2026-12-31T23:59:59.999Z"),
        expiraEm: new Date("2027-01-01T00:14:59.999Z"),
      };

      await base.gravarProposta(comCriancas);
      await base.gravarProposta(semCriancas);

      expect(await base.lerProposta(comCriancas.id)).toEqual(comCriancas);
      expect(await base.lerProposta(semCriancas.id)).toEqual(semCriancas);
    });

    it("lê undefined para um id de Proposta que nunca foi gravado", async () => {
      const base = await criarBase(dados);

      expect(await base.lerProposta("c3".repeat(32))).toBeUndefined();
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
