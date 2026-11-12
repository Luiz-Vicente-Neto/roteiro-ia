/** Domain types of the catalog. Storage adapters translate to and from these. */
import type { Grupo } from "./entradas";

export interface Destino {
  slug: string;
  nome: string;
}

export interface Hotel {
  slug: string;
  nome: string;
  /** Slug of the Destino where the Hotel is. */
  destino: string;
  aceitaPet: boolean;
}

export interface Pacote {
  /** Human-readable id the model copies, e.g. `gramado-serra-azul-3n`. */
  slug: string;
  nome: string;
  /** Slug of the Hotel. */
  hotel: string;
  noites: number;
  inclui: string[];
  /** Price per adult in baixa temporada, in centavos (a multiple of 100). */
  precoBase: number;
  politicaDeCriancas: PoliticaDeCriancas;
}

/** Ages from `idadeMinima` to `idadeMaxima`, inclusive, pay `percentual` % of the adult price. */
export interface FaixaDeIdade {
  idadeMinima: number;
  idadeMaxima: number;
  /** Whole percent of the adult price, from 0 to 100. */
  percentual: number;
}

/**
 * Política de Crianças: either the Pacote does not take children, or its
 * faixas cover every age from 0 to 11 exactly once, ordered by age.
 */
export type PoliticaDeCriancas =
  | { aceitaCriancas: false }
  | { aceitaCriancas: true; faixas: FaixaDeIdade[] };

export interface Saida {
  /** Slug of the Pacote. */
  pacote: string;
  /** Calendar date without time, `YYYY-MM-DD`, in São Paulo time. Unique per Pacote. */
  data: string;
  vagasTotais: number;
}

interface PeriodoBase {
  nome: string;
  /** First day it covers, `YYYY-MM-DD`, inclusive. */
  inicio: string;
  /** Last day it covers, `YYYY-MM-DD`, inclusive. */
  fim: string;
  /** Multiplies the Preço base of the Saídas that start inside it (e.g. 1.35). */
  fator: number;
}

/**
 * Período Tarifário: a temporada counts only for the Pacotes of its Destino,
 * a feriado nacional for every Pacote. A feriado covers the window of Saídas
 * around the long weekend, not just the day itself.
 */
export type PeriodoTarifario =
  | (PeriodoBase & {
      tipo: "temporada";
      /** Slug of the Destino. */
      destino: string;
    })
  | (PeriodoBase & { tipo: "feriado" });

/**
 * The whole catalog as read from a Base do Catálogo.
 * Lists come ordered by slug, Saídas by Pacote then date, and Períodos by
 * start date, then name, then Destino (feriados first), so every
 * implementation returns the same catalog in the same order.
 */
export interface DadosDoCatalogo {
  destinos: Destino[];
  hoteis: Hotel[];
  pacotes: Pacote[];
  saidas: Saida[];
  periodos: PeriodoTarifario[];
}

/**
 * Proposta: what the model proposed for the person to confirm. Recorded, but
 * it takes no Vagas (docs/adr/0003), and it is valid until `expiraEm`.
 */
export interface Proposta {
  /** Long and random, never sequential: nobody can guess another person's. */
  id: string;
  /** Slug of the Pacote. */
  pacote: string;
  /** Date of the Saída, `YYYY-MM-DD`. */
  data: string;
  /** The Grupo as validated, each child's age in the order given. */
  grupo: Grupo;
  /** Total of the Cotação, in centavos, so confirming can tell if the price changed. */
  total: number;
  criadaEm: Date;
  expiraEm: Date;
  /** Set when a Pré-reserva is made from it: a Proposta is used only once. */
  confirmada: boolean;
}

/**
 * Pré-reserva: the Vagas of a Saída held for a Grupo, made only when a person
 * confirms a Proposta (docs/adr/0003). It is active while `expiraEm` is after
 * now, and holds no personal data: no name, e-mail or phone.
 */
export interface PreReserva {
  /** Short and readable, `RT-XXXX`, for the person to quote. */
  codigo: string;
  /** Slug of the Pacote. */
  pacote: string;
  /** Date of the Saída, `YYYY-MM-DD`. */
  data: string;
  grupo: Grupo;
  /** Total confirmed, in centavos. */
  total: number;
  criadaEm: Date;
  expiraEm: Date;
}

/** Vagas held by active Pré-reservas on one Saída. */
export interface VagasOcupadas {
  pacote: string;
  data: string;
  vagas: number;
}
