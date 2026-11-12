// PROTOTYPE (tickets #12 and #15): throwaway fake data, no model, no catalog.
// The shapes copy what the real tools return, so the winner maps over directly.
import type { CSSProperties } from "react";

export interface Grupo {
  adultos: number;
  criancas: number[];
}

export interface Cotacao {
  pacote: {
    slug: string;
    nome: string;
    destino: { slug: string; nome: string };
    hotel: { slug: string; nome: string };
    noites: number;
    inclui: string[];
  };
  data: string;
  grupo: Grupo;
  precoBase: number;
  periodoAplicado: { nome: string; fator: number } | "baixa temporada";
  fator: number;
  precoPorPessoa: Array<{
    pessoa: "adulto" | "crianca";
    idade?: number;
    percentual?: number;
    preco: number;
  }>;
  total: number;
  vagasDoGrupo: number;
  vagasRestantes: number;
  outrasSaidas?: string[];
}

export interface Chamada {
  ferramenta: string;
  ok: boolean;
  /** One line a person can read without opening the JSON. */
  resumo: string;
  entrada: unknown;
  saida: unknown;
}

export type EstadoDaProposta =
  | "valida"
  | "confirmada"
  | "expirada"
  | "erro"
  | "descartada";

export const ESTADOS_NA_URL = [
  "valida",
  "confirmada",
  "expirada",
  "erro",
] as const;

export interface Proposta {
  id: string;
  cotacao: Cotacao;
  expiraEm: string;
  preReserva: { codigo: string; expiraEm: string };
  erro: { erro: string; mensagem: string };
}

export interface Resposta {
  id: string;
  texto: string;
  cotacoes: Cotacao[];
  /** True for `consultar_preco`: one Cotação, with the price of each person. */
  detalhar?: boolean;
  proposta?: Proposta;
  chamadas: Chamada[];
}

export interface PropsDaResposta {
  resposta: Resposta;
  estado: EstadoDaProposta;
  aoConfirmar(): void;
  aoDescartar(): void;
}

// ─── Formatting ──────────────────────────────────────────────────────────

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export const reais = (centavos: number) => moeda.format(centavos / 100);

const noMeioDia = (data: string) => new Date(`${data}T12:00:00-03:00`);
const FUSO = "America/Sao_Paulo";

/** "sáb., 10 de jul. de 2027" */
export const dataLonga = (data: string) =>
  noMeioDia(data).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: FUSO,
  });

/** "10/07" */
export const dataCurta = (data: string) =>
  noMeioDia(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: FUSO,
  });

/** "14:47" */
export const hora = (instante: string) =>
  new Date(instante).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO,
  });

/** "13/11 às 14:35" */
export const diaEHora = (instante: string) =>
  `${new Date(instante).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: FUSO,
  })} às ${hora(instante)}`;

export function grupoPorExtenso({ adultos, criancas }: Grupo): string {
  const a = `${adultos} ${adultos === 1 ? "adulto" : "adultos"}`;
  if (criancas.length === 0) return a;
  const idades = criancas.map((i) => `${i} anos`).join(", ");
  const c = `${criancas.length} ${criancas.length === 1 ? "criança" : "crianças"}`;
  return `${a} e ${c} (${idades})`;
}

export function vagasPorExtenso(vagas: number): string {
  if (vagas <= 3) return vagas === 1 ? "Última Vaga" : `Últimas ${vagas} Vagas`;
  return `${vagas} Vagas restantes`;
}

export const poucasVagas = (vagas: number) => vagas <= 3;

export function pessoaPorExtenso(p: Cotacao["precoPorPessoa"][number]) {
  return p.pessoa === "adulto"
    ? "Adulto"
    : `Criança, ${p.idade} anos (${p.percentual}% do adulto)`;
}

export function periodoPorExtenso(c: Cotacao): string {
  return c.periodoAplicado === "baixa temporada"
    ? "Baixa temporada"
    : `${c.periodoAplicado.nome} (×${c.fator.toLocaleString("pt-BR")})`;
}

// ─── Photos ──────────────────────────────────────────────────────────────

/**
 * Stand-in photo: a random picture from picsum over a gradient, which shows
 * alone when offline. The real ones (#12) are local files, one per Destino.
 */
export function foto(destino: string): CSSProperties {
  return {
    backgroundImage: `url(https://picsum.photos/seed/roteiro-${destino}/800/600), linear-gradient(135deg, #0f766e, #a8a29e)`,
  };
}

/** Fake credit: the layout needs the space the real one will take. */
export const credito = (_destino: string) => "Foto: Nome do Autor / Unsplash";

// ─── Cotações ────────────────────────────────────────────────────────────

const GRAMADO = { slug: "gramado", nome: "Gramado" };
const INVERNO = { nome: "Temporada de inverno em Gramado", fator: 1.35 };

const PACOTES = {
  aconchego: {
    slug: "gramado-vale-das-hortensias-3n",
    nome: "Gramado Aconchego",
    destino: GRAMADO,
    hotel: { slug: "vale-das-hortensias", nome: "Pousada Vale das Hortênsias" },
    noites: 3,
    inclui: ["Café da manhã", "Traslado do aeroporto", "Tour Linha Bella"],
    precoBase: 98000,
  },
  classico: {
    slug: "gramado-serra-azul-4n",
    nome: "Gramado Clássico",
    destino: GRAMADO,
    hotel: { slug: "serra-azul", nome: "Hotel Serra Azul" },
    noites: 4,
    inclui: [
      "Café da manhã",
      "Traslado do aeroporto",
      "Tour Uva e Vinho",
      "Ingresso do Snowland",
    ],
    precoBase: 138000,
  },
  palace: {
    slug: "gramado-bavaria-palace-4n",
    nome: "Gramado Bavária",
    destino: GRAMADO,
    hotel: { slug: "bavaria-palace", nome: "Bavária Palace Hotel" },
    noites: 4,
    inclui: ["Café da manhã", "Jantar de fondue", "Tour Canela e Caracol"],
    precoBase: 147000,
  },
};

// Same rounding as the real rule: whole reais, half up.
const arredondar = (centavos: number, centesimos: number) =>
  Math.round((centavos * centesimos) / 10_000) * 100;

function cotar(
  chave: keyof typeof PACOTES,
  data: string,
  grupo: Grupo,
  vagasRestantes: number,
  outrasSaidas?: string[],
): Cotacao {
  const { precoBase, ...pacote } = PACOTES[chave];
  const adulto = arredondar(precoBase, 135);
  const precoPorPessoa: Cotacao["precoPorPessoa"] = [
    ...Array.from({ length: grupo.adultos }, () => ({
      pessoa: "adulto" as const,
      preco: adulto,
    })),
    ...grupo.criancas.map((idade) => ({
      pessoa: "crianca" as const,
      idade,
      percentual: 50,
      preco: arredondar(adulto, 50),
    })),
  ];
  return {
    pacote,
    data,
    grupo,
    precoBase,
    periodoAplicado: INVERNO,
    fator: INVERNO.fator,
    precoPorPessoa,
    total: precoPorPessoa.reduce((soma, p) => soma + p.preco, 0),
    vagasDoGrupo: grupo.adultos + grupo.criancas.length,
    vagasRestantes,
    ...(outrasSaidas ? { outrasSaidas } : {}),
  };
}

const CASAL: Grupo = { adultos: 2, criancas: [] };
const FAMILIA: Grupo = { adultos: 2, criancas: [7] };

const daBusca = [
  cotar("aconchego", "2027-07-08", CASAL, 6, ["2027-07-15", "2027-07-22"]),
  cotar("classico", "2027-07-10", CASAL, 2, ["2027-07-17"]),
  cotar("palace", "2027-07-09", CASAL, 12, []),
];

const daFamilia = cotar("classico", "2027-07-17", FAMILIA, 9);

// ─── Conversa ────────────────────────────────────────────────────────────

export type Mensagem =
  | { de: "viajante"; id: string; texto: string }
  | ({ de: "assistente" } & Resposta);

const JANELA = { inicio: "2027-07-01", fim: "2027-07-31" };

export const CONVERSA: Mensagem[] = [
  {
    de: "viajante",
    id: "v1",
    texto: "4 dias na Serra Gaúcha em julho, casal, até R$ 4 mil",
  },
  {
    de: "assistente",
    id: "a1",
    texto:
      "Encontrei três Pacotes em Gramado que cabem no orçamento. O mais em conta é o Aconchego, de 3 noites. Se fizer questão das 4 noites, o Clássico tem só mais 2 Vagas na Saída mais barata. Os detalhes estão nos cards abaixo.",
    cotacoes: daBusca,
    chamadas: [
      {
        ferramenta: "buscar_pacotes",
        ok: false,
        resumo: "Destino desconhecido: Serra Gaúcha",
        entrada: {
          grupo: CASAL,
          destino: "Serra Gaúcha",
          janela: JANELA,
          orcamento: 400000,
        },
        saida: {
          ok: false,
          erro: "DESTINO_DESCONHECIDO",
          mensagem: "Não há Destino chamado Serra Gaúcha no catálogo.",
          sugestoes: [
            "Bonito",
            "Campos do Jordão",
            "Foz do Iguaçu",
            "Gramado",
            "Jericoacoara",
            "Lençóis Maranhenses",
            "Porto de Galinhas",
          ],
        },
      },
      {
        ferramenta: "buscar_pacotes",
        ok: true,
        resumo: "3 Cotações em Gramado, até R$ 4.000",
        entrada: {
          grupo: CASAL,
          destino: "Gramado",
          janela: JANELA,
          orcamento: 400000,
        },
        saida: { ok: true, cotacoes: daBusca },
      },
    ],
  },
  {
    de: "viajante",
    id: "v2",
    texto:
      "E o Clássico no dia 17, se a gente levar nossa filha de 7 anos, quanto fica?",
  },
  {
    de: "assistente",
    id: "a2",
    texto:
      "Com a filha de vocês, o Clássico na Saída de 17 de julho fica como no card abaixo. Ela paga metade do preço de adulto e ocupa uma Vaga.",
    cotacoes: [daFamilia],
    detalhar: true,
    chamadas: [
      {
        ferramenta: "consultar_preco",
        ok: true,
        resumo: "Gramado Clássico em 17/07, 2 adultos e 1 criança",
        entrada: {
          pacote: "gramado-serra-azul-4n",
          data: "2027-07-17",
          grupo: FAMILIA,
        },
        saida: { ok: true, ...daFamilia },
      },
    ],
  },
  { de: "viajante", id: "v3", texto: "Fechado, pode reservar essa." },
  {
    de: "assistente",
    id: "a3",
    texto:
      "Preparei a Proposta abaixo. Ela ainda não bloqueia as Vagas: confira os dados e confirme para garantir.",
    cotacoes: [],
    proposta: {
      id: "prop_8f3kq2mz7w1x",
      cotacao: daFamilia,
      expiraEm: "2026-11-12T14:47:00-03:00",
      preReserva: { codigo: "RT-7K2M", expiraEm: "2026-11-13T14:35:00-03:00" },
      erro: {
        erro: "VAGAS_INSUFICIENTES",
        mensagem: "As Vagas desta Saída acabaram antes da confirmação.",
      },
    },
    chamadas: [
      {
        ferramenta: "verificar_disponibilidade",
        ok: true,
        resumo: "9 Vagas restantes de 16",
        entrada: { pacote: "gramado-serra-azul-4n", data: "2027-07-17" },
        saida: { ok: true, vagasTotais: 16, vagasRestantes: 9 },
      },
      {
        ferramenta: "propor_pre_reserva",
        ok: true,
        resumo: "Proposta criada, vale 15 minutos",
        entrada: {
          pacote: "gramado-serra-azul-4n",
          data: "2027-07-17",
          grupo: FAMILIA,
        },
        saida: {
          ok: true,
          proposta: { id: "prop_8f3kq2mz7w1x" },
          cotacao: daFamilia,
          expiraEm: "2026-11-12T17:47:00.000Z",
        },
      },
    ],
  },
];

// ─── Proposta: copy of each state, shared so variants differ only in shape ─

export function textoDoEstado(proposta: Proposta, estado: EstadoDaProposta) {
  switch (estado) {
    case "valida":
      return {
        titulo: "Proposta de Pré-reserva",
        detalhe: `Vale até ${hora(proposta.expiraEm)}. As Vagas só ficam garantidas depois que você confirmar.`,
      };
    case "confirmada":
      return {
        titulo: "Pré-reserva confirmada",
        detalhe: `Vagas bloqueadas até ${diaEHora(proposta.preReserva.expiraEm)}.`,
      };
    case "expirada":
      return {
        titulo: "Proposta expirada",
        detalhe: `Ela valia até ${hora(proposta.expiraEm)}. Peça uma nova Proposta na conversa.`,
      };
    case "erro":
      return {
        titulo: "Não foi possível confirmar",
        detalhe: `${proposta.erro.mensagem} Peça uma nova Proposta na conversa.`,
      };
    case "descartada":
      return {
        titulo: "Proposta descartada",
        detalhe: "Nada foi reservado.",
      };
  }
}
