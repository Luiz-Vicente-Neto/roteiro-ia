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
}

export interface Saida {
  /** Slug of the Pacote. */
  pacote: string;
  /** Calendar date without time, `YYYY-MM-DD`, in São Paulo time. Unique per Pacote. */
  data: string;
  vagasTotais: number;
}

/**
 * The whole catalog as read from a Base do Catálogo.
 * Lists come ordered by slug, and Saídas by Pacote then date, so every
 * implementation returns the same catalog in the same order.
 */
export interface DadosDoCatalogo {
  destinos: Destino[];
  hoteis: Hotel[];
  pacotes: Pacote[];
  saidas: Saida[];
}
