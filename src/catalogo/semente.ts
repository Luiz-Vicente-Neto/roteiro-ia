import type { DadosDoCatalogo } from "./tipos";

/**
 * The single, hand-written, deterministic source of the catalog. It loads
 * Postgres through the seed and the in-memory Base in tests and evaluation,
 * so both always hold exactly the same catalog.
 *
 * Small on purpose for now: 1 Destino and a few Pacotes. The full 2027
 * catalog comes in a later ticket.
 */
export const semente: DadosDoCatalogo = {
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
    },
    {
      slug: "gramado-vale-das-hortensias-4n",
      nome: "Gramado com Pet no Vale das Hortênsias",
      hotel: "vale-das-hortensias",
      noites: 4,
      inclui: ["Café da manhã", "Fondue de boas-vindas"],
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
};
