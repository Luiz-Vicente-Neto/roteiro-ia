/** Domain types of the catalog. Storage adapters translate to and from these. */

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
}

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
