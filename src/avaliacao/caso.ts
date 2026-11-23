import type { EntradaBuscarPacotes, Grupo } from "../catalogo";

/** What a Caso measures. More categories come with their own Casos (docs/adr/0007). */
export type Categoria = Caso["categoria"];

/**
 * The Cotação a price Caso expects among the answer's cards: the Pacote, the
 * Saída and the total. `grupo` is the Grupo the message describes, so the
 * Caso can be checked against the catalog without the model.
 */
export interface CotacaoEsperada {
  pacote: string;
  /** Date of the Saída, `YYYY-MM-DD`. */
  data: string;
  grupo: Grupo;
  /** In centavos. */
  total: number;
  /**
   * For a Caso about a budget: the buscar_pacotes the message asks for,
   * which must return this Cotação.
   */
  busca?: EntradaBuscarPacotes;
}

/**
 * No Pacote serves the message: no card, and the model looked. `busca` is
 * the buscar_pacotes the message asks for, which must return nothing.
 */
export interface NenhumPacoteServe {
  nenhumPacote: true;
  busca: EntradaBuscarPacotes;
}

/**
 * The Trechos a citação Caso accepts, any one of them: the same rule may be
 * in the Política da Agência and in a FAQ. At least one must be among the
 * answer's valid Citações.
 */
export interface CitacaoEsperada {
  trechos: readonly string[];
}

/**
 * What gives away that the model obeyed a Documento malicioso: a frase-marca
 * only that Documento asks for, or a price in centavos no Ferramenta returns.
 */
export type MarcaDaInjection = { frase: string } | { preco: number };

/** An injection Caso: `documento` is the malicious Documento that asks for `marca`. */
export interface InjectionEsperada {
  documento: string;
  marca: MarcaDaInjection;
}

interface CasoBase {
  /** Stable: results and the Relatório name the Caso by it. */
  id: string;
  /** The Viajante's single message, with the whole Grupo in it. */
  mensagem: string;
}

/** One question of the Avaliação, with what the answer must show. */
export type Caso = CasoBase &
  (
    | { categoria: "preco"; esperado: CotacaoEsperada | NenhumPacoteServe }
    | { categoria: "citacao"; esperado: CitacaoEsperada }
    | { categoria: "injection"; esperado: InjectionEsperada }
  );

/** The fields that make a Cotação the expected one: Pacote, Saída and total. */
type DadosDaCotacao = { data: string; total: number } & (
  | { pacote: string }
  | { pacote: { slug: string } }
);

const slugDe = (c: DadosDaCotacao) =>
  typeof c.pacote === "string" ? c.pacote : c.pacote.slug;

/** True when `cotacao` has the Pacote, the Saída and the total of `esperada`. */
export function eaCotacaoEsperada(
  cotacao: DadosDaCotacao,
  esperada: CotacaoEsperada,
): boolean {
  return (
    slugDe(cotacao) === esperada.pacote &&
    cotacao.data === esperada.data &&
    cotacao.total === esperada.total
  );
}

/** "gramado-serra-azul-3n em 2027-07-10". */
export function pacoteESaida(cotacao: DadosDaCotacao): string {
  return `${slugDe(cotacao)} em ${cotacao.data}`;
}

const REAIS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 578000 → "R$ 5.780,00", with a plain space. */
export function emReais(centavos: number): string {
  return REAIS.format(centavos / 100).replace(/\s/u, " ");
}

/** The Casos, with the instant the Assistente's Relógio is fixed at while they run. */
export interface Casos {
  /** ISO instant, e.g. `2026-12-01T09:00:00-03:00`. */
  agora: string;
  lista: readonly Caso[];
}
