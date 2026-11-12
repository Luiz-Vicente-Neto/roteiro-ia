import type { DadosDoCatalogo } from "./tipos";

/**
 * A small catalog the operation tests rely on: 1 Destino, a few Pacotes with
 * Saídas only in January and February 2027, so the expected nearest Saídas
 * stay fixed. The full catalog is in semente.ts.
 */
export const catalogoDeTeste: DadosDoCatalogo = {
  destinos: [{ slug: "gramado", nome: "Gramado" }],
  hoteis: [
    {
      slug: "serra-azul",
      nome: "Hotel Serra Azul",
      destino: "gramado",
      aceitaPet: false,
    },
    {
      slug: "vale-das-hortensias",
      nome: "Pousada Vale das Hortênsias",
      destino: "gramado",
      aceitaPet: true,
    },
  ],
  pacotes: [
    {
      slug: "gramado-serra-azul-3n",
      nome: "Gramado Essencial no Serra Azul",
      hotel: "serra-azul",
      noites: 3,
      inclui: [
        "Café da manhã",
        "Traslado rodoviária–hotel",
        "City tour por Gramado e Canela",
      ],
      precoBase: 214100,
      politicaDeCriancas: {
        aceitaCriancas: true,
        faixas: [
          { idadeMinima: 0, idadeMaxima: 5, percentual: 0 },
          { idadeMinima: 6, idadeMaxima: 11, percentual: 50 },
        ],
      },
    },
    {
      slug: "gramado-serra-azul-5n",
      nome: "Gramado Completo no Serra Azul",
      hotel: "serra-azul",
      noites: 5,
      inclui: [
        "Café da manhã",
        "Traslado rodoviária–hotel",
        "City tour por Gramado e Canela",
        "Passeio de Maria Fumaça",
      ],
      precoBase: 329000,
      politicaDeCriancas: {
        aceitaCriancas: true,
        faixas: [
          { idadeMinima: 0, idadeMaxima: 1, percentual: 0 },
          { idadeMinima: 2, idadeMaxima: 11, percentual: 70 },
        ],
      },
    },
    {
      slug: "gramado-vale-das-hortensias-4n",
      nome: "Gramado com Pet no Vale das Hortênsias",
      hotel: "vale-das-hortensias",
      noites: 4,
      inclui: ["Café da manhã", "Fondue de boas-vindas"],
      precoBase: 276000,
      politicaDeCriancas: { aceitaCriancas: false },
    },
  ],
  saidas: [
    { pacote: "gramado-serra-azul-3n", data: "2027-01-09", vagasTotais: 20 },
    { pacote: "gramado-serra-azul-3n", data: "2027-01-16", vagasTotais: 20 },
    { pacote: "gramado-serra-azul-3n", data: "2027-01-23", vagasTotais: 3 },
    { pacote: "gramado-serra-azul-3n", data: "2027-01-30", vagasTotais: 20 },
    { pacote: "gramado-serra-azul-3n", data: "2027-02-06", vagasTotais: 16 },
    { pacote: "gramado-serra-azul-5n", data: "2027-01-10", vagasTotais: 12 },
    { pacote: "gramado-serra-azul-5n", data: "2027-01-24", vagasTotais: 12 },
    { pacote: "gramado-serra-azul-5n", data: "2027-02-07", vagasTotais: 8 },
    {
      pacote: "gramado-vale-das-hortensias-4n",
      data: "2027-01-14",
      vagasTotais: 10,
    },
    {
      pacote: "gramado-vale-das-hortensias-4n",
      data: "2027-01-28",
      vagasTotais: 2,
    },
  ],
  periodos: [
    {
      nome: "Natal Luz",
      tipo: "temporada",
      destino: "gramado",
      inicio: "2026-10-22",
      fim: "2027-01-17",
      fator: 1.25,
    },
    // Covers the Saídas of the New Year week, so it overlaps Natal Luz.
    {
      nome: "Confraternização Universal",
      tipo: "feriado",
      inicio: "2026-12-26",
      fim: "2027-01-03",
      fator: 1.4,
    },
    {
      nome: "Carnaval",
      tipo: "feriado",
      inicio: "2027-02-05",
      fim: "2027-02-10",
      fator: 1.3,
    },
  ],
};
