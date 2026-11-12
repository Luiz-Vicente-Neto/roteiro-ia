import type {
  DadosDoCatalogo,
  Destino,
  Hotel,
  Pacote,
  PeriodoTarifario,
  PoliticaDeCriancas,
  Saida,
} from "./tipos";

/*
 * The single, hand-written, deterministic source of the catalog. It loads
 * Postgres through the seed and the in-memory Base in tests and evaluation,
 * so both always hold exactly the same catalog. No LLM generates any of it.
 *
 * Pacotes, Hotéis and Períodos are written out one by one. Saídas are weekly
 * through 2027: each Pacote names its weekday and a cycle of Vagas, and the
 * Saídas follow from that, so the 2,000-odd rows stay reviewable.
 */

const ANO_DAS_SAIDAS = 2027;

// ─── Políticas de Crianças ───────────────────────────────────────────────

/** The most common: under 6 free, 6 to 11 pay half. */
const CRIANCA_ATE_5_GRATIS: PoliticaDeCriancas = {
  aceitaCriancas: true,
  faixas: [
    { idadeMinima: 0, idadeMaxima: 5, percentual: 0 },
    { idadeMinima: 6, idadeMaxima: 11, percentual: 50 },
  ],
};

/** Family resorts and pousadas: only babies free, from 2 years a larger share. */
const SO_BEBE_GRATIS: PoliticaDeCriancas = {
  aceitaCriancas: true,
  faixas: [
    { idadeMinima: 0, idadeMaxima: 1, percentual: 0 },
    { idadeMinima: 2, idadeMaxima: 11, percentual: 70 },
  ],
};

/** Couples' and adventure Pacotes. */
const SEM_CRIANCAS: PoliticaDeCriancas = { aceitaCriancas: false };

// ─── Destinos e Hotéis ───────────────────────────────────────────────────

const destinos: Destino[] = [
  { slug: "gramado", nome: "Gramado" },
  { slug: "campos-do-jordao", nome: "Campos do Jordão" },
  { slug: "bonito", nome: "Bonito" },
  { slug: "foz-do-iguacu", nome: "Foz do Iguaçu" },
  { slug: "porto-de-galinhas", nome: "Porto de Galinhas" },
  { slug: "jericoacoara", nome: "Jericoacoara" },
  { slug: "lencois-maranhenses", nome: "Lençóis Maranhenses" },
];

const hoteis: Hotel[] = [
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
  {
    slug: "bavaria-palace",
    nome: "Bavária Palace Hotel",
    destino: "gramado",
    aceitaPet: false,
  },
  {
    slug: "chateau-montanha",
    nome: "Château da Montanha",
    destino: "campos-do-jordao",
    aceitaPet: false,
  },
  {
    slug: "recanto-das-araucarias",
    nome: "Recanto das Araucárias",
    destino: "campos-do-jordao",
    aceitaPet: true,
  },
  {
    slug: "vila-capivari",
    nome: "Hotel Vila Capivari",
    destino: "campos-do-jordao",
    aceitaPet: false,
  },
  {
    slug: "aguas-cristalinas",
    nome: "Hotel Águas Cristalinas",
    destino: "bonito",
    aceitaPet: false,
  },
  {
    slug: "pousada-gruta-azul",
    nome: "Pousada Gruta Azul",
    destino: "bonito",
    aceitaPet: true,
  },
  {
    slug: "cataratas-park",
    nome: "Cataratas Park Hotel",
    destino: "foz-do-iguacu",
    aceitaPet: false,
  },
  {
    slug: "tres-fronteiras",
    nome: "Hotel Três Fronteiras",
    destino: "foz-do-iguacu",
    aceitaPet: true,
  },
  {
    slug: "mata-atlantica-resort",
    nome: "Mata Atlântica Resort",
    destino: "foz-do-iguacu",
    aceitaPet: false,
  },
  {
    slug: "recife-dos-corais",
    nome: "Hotel Recife dos Corais",
    destino: "porto-de-galinhas",
    aceitaPet: false,
  },
  {
    slug: "pousada-maracaipe",
    nome: "Pousada Maracaípe",
    destino: "porto-de-galinhas",
    aceitaPet: true,
  },
  {
    slug: "enseada-resort",
    nome: "Enseada Resort All Inclusive",
    destino: "porto-de-galinhas",
    aceitaPet: false,
  },
  {
    slug: "vila-kalango",
    nome: "Vila Kalango",
    destino: "jericoacoara",
    aceitaPet: true,
  },
  {
    slug: "duna-do-por-do-sol",
    nome: "Hotel Duna do Pôr do Sol",
    destino: "jericoacoara",
    aceitaPet: false,
  },
  {
    slug: "pousada-dos-ventos",
    nome: "Pousada dos Ventos",
    destino: "jericoacoara",
    aceitaPet: false,
  },
  {
    slug: "barreirinhas-lodge",
    nome: "Barreirinhas Lodge",
    destino: "lencois-maranhenses",
    aceitaPet: false,
  },
  {
    slug: "oasis-dos-lencois",
    nome: "Pousada Oásis dos Lençóis",
    destino: "lencois-maranhenses",
    aceitaPet: true,
  },
];

// ─── Pacotes and their Saídas ───────────────────────────────────────────────

const DOMINGO = 0;
const SEGUNDA = 1;
const TERCA = 2;
const QUARTA = 3;
const QUINTA = 4;
const SEXTA = 5;
const SABADO = 6;

/*
 * Vagas of each weekly Saída, repeated in a cycle. The cycles have different
 * lengths, so the Saídas with few Vagas (the "restam N vagas" cases) fall on
 * different weeks in each Pacote.
 */
const VAGAS_GRUPO_GRANDE = [30, 28, 30, 4, 30, 24, 30, 18, 30, 2];
const VAGAS_GRUPO_MEDIO = [20, 16, 20, 3, 20, 12, 18, 20, 1];
const VAGAS_GRUPO_PEQUENO = [12, 10, 2, 12, 8, 12, 4, 12];
const VAGAS_GRUPO_EXCLUSIVO = [8, 6, 8, 1, 8, 3];

interface PacoteDaSemente extends Pacote {
  /** Weekday of every Saída, 0 = domingo. */
  diaDaSaida: number;
  vagas: number[];
}

const pacotesDaSemente: PacoteDaSemente[] = [
  // Gramado
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
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: SABADO,
    vagas: VAGAS_GRUPO_MEDIO,
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
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: DOMINGO,
    vagas: VAGAS_GRUPO_MEDIO,
  },
  {
    slug: "gramado-vale-das-hortensias-2n",
    nome: "Escapada com Pet em Gramado",
    hotel: "vale-das-hortensias",
    noites: 2,
    inclui: ["Café da manhã", "Kit de boas-vindas para o pet"],
    precoBase: 149000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: SEXTA,
    vagas: VAGAS_GRUPO_EXCLUSIVO,
  },
  {
    slug: "gramado-vale-das-hortensias-4n",
    nome: "Gramado com Pet no Vale das Hortênsias",
    hotel: "vale-das-hortensias",
    noites: 4,
    inclui: ["Café da manhã", "Fondue de boas-vindas"],
    precoBase: 276000,
    politicaDeCriancas: SEM_CRIANCAS,
    diaDaSaida: QUINTA,
    vagas: VAGAS_GRUPO_EXCLUSIVO,
  },
  {
    slug: "gramado-bavaria-palace-3n",
    nome: "Gramado Charme no Bavária Palace",
    hotel: "bavaria-palace",
    noites: 3,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária–hotel",
      "Jantar de fondue",
      "Ingresso para o Snowland",
    ],
    precoBase: 289000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: SEXTA,
    vagas: VAGAS_GRUPO_PEQUENO,
  },
  {
    slug: "gramado-bavaria-palace-7n",
    nome: "Serra Gaúcha Completa no Bavária Palace",
    hotel: "bavaria-palace",
    noites: 7,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária–hotel",
      "City tour por Gramado e Canela",
      "Passeio de Maria Fumaça",
      "Roteiro das vinícolas do Vale dos Vinhedos",
    ],
    precoBase: 559000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: SABADO,
    vagas: VAGAS_GRUPO_GRANDE,
  },
  // Campos do Jordão
  {
    slug: "campos-do-jordao-chateau-montanha-2n",
    nome: "Fim de Semana na Serra no Château da Montanha",
    hotel: "chateau-montanha",
    noites: 2,
    inclui: ["Café da manhã", "Fondue de queijo"],
    precoBase: 129000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: SEXTA,
    vagas: VAGAS_GRUPO_PEQUENO,
  },
  {
    slug: "campos-do-jordao-chateau-montanha-4n",
    nome: "Campos do Jordão Clássico no Château da Montanha",
    hotel: "chateau-montanha",
    noites: 4,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária–hotel",
      "Bondinho do Morro do Elefante",
      "Passeio ao Horto Florestal",
    ],
    precoBase: 239000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: DOMINGO,
    vagas: VAGAS_GRUPO_MEDIO,
  },
  {
    slug: "campos-do-jordao-recanto-das-araucarias-3n",
    nome: "Serra com Pet no Recanto das Araucárias",
    hotel: "recanto-das-araucarias",
    noites: 3,
    inclui: ["Café da manhã", "Trilha guiada pelas araucárias"],
    precoBase: 178000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: SABADO,
    vagas: VAGAS_GRUPO_EXCLUSIVO,
  },
  {
    slug: "campos-do-jordao-recanto-das-araucarias-7n",
    nome: "Semana na Mantiqueira no Recanto das Araucárias",
    hotel: "recanto-das-araucarias",
    noites: 7,
    inclui: [
      "Café da manhã",
      "Trilha guiada pelas araucárias",
      "Passeio a Santo Antônio do Pinhal",
      "Visita a uma cervejaria artesanal",
    ],
    precoBase: 389000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: SABADO,
    vagas: VAGAS_GRUPO_PEQUENO,
  },
  {
    slug: "campos-do-jordao-vila-capivari-3n",
    nome: "Capivari a Dois na Vila Capivari",
    hotel: "vila-capivari",
    noites: 3,
    inclui: ["Café da manhã", "Jantar romântico", "Day use no spa"],
    precoBase: 199000,
    politicaDeCriancas: SEM_CRIANCAS,
    diaDaSaida: QUINTA,
    vagas: VAGAS_GRUPO_EXCLUSIVO,
  },
  {
    slug: "campos-do-jordao-vila-capivari-5n",
    nome: "Capivari sem Pressa na Vila Capivari",
    hotel: "vila-capivari",
    noites: 5,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária–hotel",
      "Bondinho do Morro do Elefante",
      "Day use no spa",
    ],
    precoBase: 315000,
    politicaDeCriancas: SEM_CRIANCAS,
    diaDaSaida: SEGUNDA,
    vagas: VAGAS_GRUPO_PEQUENO,
  },
  // Bonito
  {
    slug: "bonito-aguas-cristalinas-3n",
    nome: "Bonito Essencial no Águas Cristalinas",
    hotel: "aguas-cristalinas",
    noites: 3,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária–hotel",
      "Flutuação no Rio da Prata",
      "Gruta do Lago Azul",
    ],
    precoBase: 245000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: SABADO,
    vagas: VAGAS_GRUPO_MEDIO,
  },
  {
    slug: "bonito-aguas-cristalinas-5n",
    nome: "Bonito Completo no Águas Cristalinas",
    hotel: "aguas-cristalinas",
    noites: 5,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária–hotel",
      "Flutuação no Rio da Prata",
      "Gruta do Lago Azul",
      "Boia-cross no Rio Formoso",
      "Cachoeiras da Estância Mimosa",
    ],
    precoBase: 369000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: DOMINGO,
    vagas: VAGAS_GRUPO_GRANDE,
  },
  {
    slug: "bonito-aguas-cristalinas-7n",
    nome: "Bonito e Pantanal no Águas Cristalinas",
    hotel: "aguas-cristalinas",
    noites: 7,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária–hotel",
      "Flutuação no Rio da Prata",
      "Gruta do Lago Azul",
      "Safári fotográfico no Pantanal",
    ],
    precoBase: 579000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: TERCA,
    vagas: VAGAS_GRUPO_PEQUENO,
  },
  {
    slug: "bonito-pousada-gruta-azul-4n",
    nome: "Bonito com Pet na Pousada Gruta Azul",
    hotel: "pousada-gruta-azul",
    noites: 4,
    inclui: ["Café da manhã", "Balneário Municipal", "Gruta do Lago Azul"],
    precoBase: 279000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: QUARTA,
    vagas: VAGAS_GRUPO_EXCLUSIVO,
  },
  {
    slug: "bonito-pousada-gruta-azul-6n",
    nome: "Águas de Bonito na Pousada Gruta Azul",
    hotel: "pousada-gruta-azul",
    noites: 6,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária–hotel",
      "Flutuação no Rio Sucuri",
      "Boia-cross no Rio Formoso",
      "Abismo Anhumas (observação)",
    ],
    precoBase: 405000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: SABADO,
    vagas: VAGAS_GRUPO_PEQUENO,
  },
  // Foz do Iguaçu
  {
    slug: "foz-do-iguacu-cataratas-park-3n",
    nome: "Foz Essencial no Cataratas Park",
    hotel: "cataratas-park",
    noites: 3,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária–hotel",
      "Cataratas do lado brasileiro",
      "Parque das Aves",
    ],
    precoBase: 189000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: SEXTA,
    vagas: VAGAS_GRUPO_GRANDE,
  },
  {
    slug: "foz-do-iguacu-cataratas-park-4n",
    nome: "Foz e as Duas Cataratas no Cataratas Park",
    hotel: "cataratas-park",
    noites: 4,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária–hotel",
      "Cataratas do lado brasileiro",
      "Cataratas do lado argentino",
      "Itaipu Binacional",
    ],
    precoBase: 239000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: SEGUNDA,
    vagas: VAGAS_GRUPO_MEDIO,
  },
  {
    slug: "foz-do-iguacu-tres-fronteiras-3n",
    nome: "Foz com Pet no Três Fronteiras",
    hotel: "tres-fronteiras",
    noites: 3,
    inclui: ["Café da manhã", "Marco das Três Fronteiras"],
    precoBase: 169000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: SABADO,
    vagas: VAGAS_GRUPO_MEDIO,
  },
  {
    slug: "foz-do-iguacu-tres-fronteiras-5n",
    nome: "Foz em Família no Três Fronteiras",
    hotel: "tres-fronteiras",
    noites: 5,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária–hotel",
      "Cataratas do lado brasileiro",
      "Parque das Aves",
      "Marco das Três Fronteiras",
    ],
    precoBase: 259000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: DOMINGO,
    vagas: VAGAS_GRUPO_PEQUENO,
  },
  {
    slug: "foz-do-iguacu-mata-atlantica-resort-4n",
    nome: "Foz Resort no Mata Atlântica",
    hotel: "mata-atlantica-resort",
    noites: 4,
    inclui: [
      "Meia pensão",
      "Traslado rodoviária–hotel",
      "Cataratas do lado brasileiro",
      "Macuco Safari",
    ],
    precoBase: 349000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: QUINTA,
    vagas: VAGAS_GRUPO_PEQUENO,
  },
  {
    slug: "foz-do-iguacu-mata-atlantica-resort-7n",
    nome: "Foz Completa no Mata Atlântica",
    hotel: "mata-atlantica-resort",
    noites: 7,
    inclui: [
      "Meia pensão",
      "Traslado rodoviária–hotel",
      "Cataratas do lado brasileiro",
      "Cataratas do lado argentino",
      "Macuco Safari",
      "Itaipu Binacional",
    ],
    precoBase: 549000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: SABADO,
    vagas: VAGAS_GRUPO_EXCLUSIVO,
  },
  // Porto de Galinhas
  {
    slug: "porto-de-galinhas-recife-dos-corais-4n",
    nome: "Porto de Galinhas Essencial no Recife dos Corais",
    hotel: "recife-dos-corais",
    noites: 4,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária de Recife–hotel",
      "Passeio de jangada às piscinas naturais",
    ],
    precoBase: 269000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: SABADO,
    vagas: VAGAS_GRUPO_GRANDE,
  },
  {
    slug: "porto-de-galinhas-recife-dos-corais-7n",
    nome: "Semana no Litoral Sul no Recife dos Corais",
    hotel: "recife-dos-corais",
    noites: 7,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária de Recife–hotel",
      "Passeio de jangada às piscinas naturais",
      "Passeio de buggy até Maracaípe",
      "Praia dos Carneiros",
    ],
    precoBase: 429000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: DOMINGO,
    vagas: VAGAS_GRUPO_MEDIO,
  },
  {
    slug: "porto-de-galinhas-pousada-maracaipe-3n",
    nome: "Maracaípe a Dois",
    hotel: "pousada-maracaipe",
    noites: 3,
    inclui: ["Café da manhã", "Passeio de jangada ao pôr do sol"],
    precoBase: 179000,
    politicaDeCriancas: SEM_CRIANCAS,
    diaDaSaida: QUINTA,
    vagas: VAGAS_GRUPO_EXCLUSIVO,
  },
  {
    slug: "porto-de-galinhas-pousada-maracaipe-5n",
    nome: "Porto de Galinhas com Pet na Pousada Maracaípe",
    hotel: "pousada-maracaipe",
    noites: 5,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária de Recife–hotel",
      "Passeio de buggy até Maracaípe",
    ],
    precoBase: 289000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: QUARTA,
    vagas: VAGAS_GRUPO_PEQUENO,
  },
  {
    slug: "porto-de-galinhas-enseada-resort-5n",
    nome: "Porto de Galinhas All Inclusive no Enseada",
    hotel: "enseada-resort",
    noites: 5,
    inclui: [
      "Pensão completa com bebidas",
      "Traslado rodoviária de Recife–hotel",
      "Clube infantil",
    ],
    precoBase: 459000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: SEXTA,
    vagas: VAGAS_GRUPO_GRANDE,
  },
  {
    slug: "porto-de-galinhas-enseada-resort-7n",
    nome: "Férias em Família no Enseada Resort",
    hotel: "enseada-resort",
    noites: 7,
    inclui: [
      "Pensão completa com bebidas",
      "Traslado rodoviária de Recife–hotel",
      "Clube infantil",
      "Passeio de jangada às piscinas naturais",
    ],
    precoBase: 619000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: SABADO,
    vagas: VAGAS_GRUPO_MEDIO,
  },
  // Jericoacoara
  {
    slug: "jericoacoara-vila-kalango-4n",
    nome: "Jeri Rústica na Vila Kalango",
    hotel: "vila-kalango",
    noites: 4,
    inclui: ["Café da manhã", "Traslado em 4x4 desde Jijoca"],
    precoBase: 259000,
    politicaDeCriancas: SEM_CRIANCAS,
    diaDaSaida: QUARTA,
    vagas: VAGAS_GRUPO_EXCLUSIVO,
  },
  {
    slug: "jericoacoara-vila-kalango-7n",
    nome: "Jeri Pé na Areia na Vila Kalango",
    hotel: "vila-kalango",
    noites: 7,
    inclui: [
      "Café da manhã",
      "Traslado em 4x4 desde Jijoca",
      "Passeio de buggy à Lagoa do Paraíso",
      "Pôr do sol na Duna do Pôr do Sol",
    ],
    precoBase: 389000,
    politicaDeCriancas: SEM_CRIANCAS,
    diaDaSaida: SABADO,
    vagas: VAGAS_GRUPO_PEQUENO,
  },
  {
    slug: "jericoacoara-duna-do-por-do-sol-3n",
    nome: "Jeri Expressa no Duna do Pôr do Sol",
    hotel: "duna-do-por-do-sol",
    noites: 3,
    inclui: ["Café da manhã", "Traslado em 4x4 desde Jijoca", "Pedra Furada"],
    precoBase: 229000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: QUINTA,
    vagas: VAGAS_GRUPO_MEDIO,
  },
  {
    slug: "jericoacoara-duna-do-por-do-sol-5n",
    nome: "Jeri das Lagoas no Duna do Pôr do Sol",
    hotel: "duna-do-por-do-sol",
    noites: 5,
    inclui: [
      "Café da manhã",
      "Traslado em 4x4 desde Jijoca",
      "Passeio de buggy à Lagoa do Paraíso",
      "Lagoa Azul",
      "Pedra Furada",
    ],
    precoBase: 339000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: DOMINGO,
    vagas: VAGAS_GRUPO_GRANDE,
  },
  {
    slug: "jericoacoara-pousada-dos-ventos-4n",
    nome: "Jeri em Família na Pousada dos Ventos",
    hotel: "pousada-dos-ventos",
    noites: 4,
    inclui: [
      "Café da manhã",
      "Traslado em 4x4 desde Jijoca",
      "Passeio de buggy à Lagoa do Paraíso",
    ],
    precoBase: 249000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: SEXTA,
    vagas: VAGAS_GRUPO_PEQUENO,
  },
  {
    slug: "jericoacoara-pousada-dos-ventos-6n",
    nome: "Kite em Jeri na Pousada dos Ventos",
    hotel: "pousada-dos-ventos",
    noites: 6,
    inclui: [
      "Café da manhã",
      "Traslado em 4x4 desde Jijoca",
      "Aula introdutória de kitesurf",
      "Passeio a Tatajuba",
    ],
    precoBase: 359000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: SEGUNDA,
    vagas: VAGAS_GRUPO_EXCLUSIVO,
  },
  // Lençóis Maranhenses
  {
    slug: "lencois-maranhenses-barreirinhas-lodge-3n",
    nome: "Lençóis Essencial no Barreirinhas Lodge",
    hotel: "barreirinhas-lodge",
    noites: 3,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária de São Luís–hotel",
      "Circuito Lagoa Azul em 4x4",
    ],
    precoBase: 219000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: SABADO,
    vagas: VAGAS_GRUPO_GRANDE,
  },
  {
    slug: "lencois-maranhenses-barreirinhas-lodge-5n",
    nome: "Lençóis e Rio Preguiças no Barreirinhas Lodge",
    hotel: "barreirinhas-lodge",
    noites: 5,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária de São Luís–hotel",
      "Circuito Lagoa Azul em 4x4",
      "Circuito Lagoa Bonita",
      "Passeio de lancha pelo Rio Preguiças",
    ],
    precoBase: 319000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: TERCA,
    vagas: VAGAS_GRUPO_MEDIO,
  },
  {
    slug: "lencois-maranhenses-barreirinhas-lodge-7n",
    nome: "Lençóis Completo no Barreirinhas Lodge",
    hotel: "barreirinhas-lodge",
    noites: 7,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária de São Luís–hotel",
      "Circuito Lagoa Azul em 4x4",
      "Circuito Lagoa Bonita",
      "Passeio de lancha pelo Rio Preguiças",
      "Visita a Atins",
    ],
    precoBase: 499000,
    politicaDeCriancas: CRIANCA_ATE_5_GRATIS,
    diaDaSaida: QUINTA,
    vagas: VAGAS_GRUPO_PEQUENO,
  },
  {
    slug: "lencois-maranhenses-oasis-dos-lencois-4n",
    nome: "Lençóis com Pet no Oásis dos Lençóis",
    hotel: "oasis-dos-lencois",
    noites: 4,
    inclui: ["Café da manhã", "Circuito Lagoa Azul em 4x4"],
    precoBase: 279000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: SEXTA,
    vagas: VAGAS_GRUPO_EXCLUSIVO,
  },
  {
    slug: "lencois-maranhenses-oasis-dos-lencois-6n",
    nome: "Lençóis em Família no Oásis dos Lençóis",
    hotel: "oasis-dos-lencois",
    noites: 6,
    inclui: [
      "Café da manhã",
      "Traslado rodoviária de São Luís–hotel",
      "Circuito Lagoa Azul em 4x4",
      "Passeio de lancha pelo Rio Preguiças",
    ],
    precoBase: 459000,
    politicaDeCriancas: SO_BEBE_GRATIS,
    diaDaSaida: DOMINGO,
    vagas: VAGAS_GRUPO_PEQUENO,
  },
];

/** One Saída on `diaDaSaida` of every week of ANO_DAS_SAIDAS, Vagas taken from the cycle in order. */
function saidasSemanais({ slug, diaDaSaida, vagas }: PacoteDaSemente): Saida[] {
  const saidas: Saida[] = [];
  const dia = new Date(Date.UTC(ANO_DAS_SAIDAS, 0, 1));
  while (dia.getUTCDay() !== diaDaSaida) dia.setUTCDate(dia.getUTCDate() + 1);
  for (let semana = 0; dia.getUTCFullYear() === ANO_DAS_SAIDAS; semana++) {
    saidas.push({
      pacote: slug,
      data: dia.toISOString().slice(0, 10),
      vagasTotais: vagas[semana % vagas.length],
    });
    dia.setUTCDate(dia.getUTCDate() + 7);
  }
  return saidas;
}

// ─── Períodos Tarifários ─────────────────────────────────────────────────

/*
 * Each feriado nacional covers 7 days, from 4 days before the holiday to 2
 * days after it (for Carnaval, the Tuesday). That takes in the Saídas of the
 * feriadão, including the Saturday of a Friday or Thursday holiday, and every
 * weekly Pacote has exactly one Saída in the window. Confraternização appears twice, for
 * New Year 2027 and for the réveillon Saídas at the end of 2027.
 */
const feriados: PeriodoTarifario[] = (
  [
    ["Confraternização Universal", "2026-12-28", "2027-01-03", 1.4],
    ["Carnaval", "2027-02-05", "2027-02-11", 1.35],
    ["Sexta-feira Santa", "2027-03-22", "2027-03-28", 1.25],
    ["Tiradentes", "2027-04-17", "2027-04-23", 1.15],
    ["Dia do Trabalho", "2027-04-27", "2027-05-03", 1.15],
    ["Corpus Christi", "2027-05-23", "2027-05-29", 1.2],
    ["Independência do Brasil", "2027-09-03", "2027-09-09", 1.15],
    ["Nossa Senhora Aparecida", "2027-10-08", "2027-10-14", 1.15],
    ["Finados", "2027-10-29", "2027-11-04", 1.1],
    ["Proclamação da República", "2027-11-11", "2027-11-17", 1.15],
    ["Consciência Negra", "2027-11-16", "2027-11-22", 1.15],
    ["Natal", "2027-12-21", "2027-12-27", 1.35],
    ["Confraternização Universal", "2027-12-28", "2028-01-03", 1.4],
  ] as const
).map(([nome, inicio, fim, fator]) => ({
  nome,
  tipo: "feriado" as const,
  inicio,
  fim,
  fator,
}));

/** Temporadas altas, per Destino. Some overlap feriados, and then the larger fator wins. */
const temporadas: PeriodoTarifario[] = (
  [
    ["gramado", "Natal Luz", "2026-10-22", "2027-01-17", 1.25],
    ["gramado", "Inverno na Serra", "2027-06-19", "2027-08-29", 1.35],
    ["gramado", "Natal Luz", "2027-10-21", "2028-01-16", 1.25],
    [
      "campos-do-jordao",
      "Fim de Ano na Serra",
      "2026-12-19",
      "2027-01-10",
      1.2,
    ],
    [
      "campos-do-jordao",
      "Temporada de Inverno",
      "2027-06-01",
      "2027-08-31",
      1.4,
    ],
    // Inside the Temporada de Inverno, with a larger fator.
    [
      "campos-do-jordao",
      "Festival de Inverno",
      "2027-07-03",
      "2027-07-25",
      1.6,
    ],
    [
      "campos-do-jordao",
      "Fim de Ano na Serra",
      "2027-12-18",
      "2028-01-09",
      1.2,
    ],
    ["bonito", "Férias de Verão", "2026-12-18", "2027-01-31", 1.3],
    ["bonito", "Férias de Julho", "2027-07-01", "2027-07-31", 1.35],
    ["bonito", "Férias de Verão", "2027-12-18", "2028-01-31", 1.3],
    ["foz-do-iguacu", "Férias de Verão", "2026-12-18", "2027-01-31", 1.2],
    ["foz-do-iguacu", "Férias de Julho", "2027-07-01", "2027-07-31", 1.3],
    ["foz-do-iguacu", "Férias de Verão", "2027-12-18", "2028-01-31", 1.2],
    ["porto-de-galinhas", "Alta de Verão", "2026-12-15", "2027-02-28", 1.4],
    ["porto-de-galinhas", "Férias de Julho", "2027-07-01", "2027-07-31", 1.3],
    ["porto-de-galinhas", "Alta de Verão", "2027-12-15", "2028-02-29", 1.4],
    ["jericoacoara", "Alta de Verão", "2026-12-15", "2027-02-28", 1.35],
    ["jericoacoara", "Férias de Julho", "2027-07-01", "2027-07-31", 1.3],
    ["jericoacoara", "Temporada dos Ventos", "2027-08-01", "2027-11-30", 1.15],
    ["jericoacoara", "Alta de Verão", "2027-12-15", "2028-02-29", 1.35],
    ["lencois-maranhenses", "Alta de Verão", "2026-12-15", "2027-02-28", 1.15],
    // The lagoons are full from June to September.
    ["lencois-maranhenses", "Lagoas Cheias", "2027-06-15", "2027-09-15", 1.35],
    ["lencois-maranhenses", "Alta de Verão", "2027-12-15", "2028-02-29", 1.15],
  ] as const
).map(([destino, nome, inicio, fim, fator]) => ({
  nome,
  tipo: "temporada" as const,
  destino,
  inicio,
  fim,
  fator,
}));

export const semente: DadosDoCatalogo = {
  destinos,
  hoteis,
  pacotes: pacotesDaSemente.map(({ diaDaSaida, vagas, ...pacote }) => pacote),
  saidas: pacotesDaSemente.flatMap(saidasSemanais),
  periodos: [...feriados, ...temporadas],
};
