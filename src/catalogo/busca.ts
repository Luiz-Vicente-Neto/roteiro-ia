// Busca de Pacotes: pure domain logic over the whole catalog (docs/adr/0001).
import type { Grupo } from "./entradas";
import { recusaDoGrupo } from "./grupo";
import { cotar } from "./preco";
import type { DadosDoCatalogo, Destino } from "./tipos";

const MAXIMO_DE_RESULTADOS = 10;

/** A Cotação without the `ok` flag, as each item of a search result. */
type Cotacao = Omit<ReturnType<typeof cotar>, "ok">;

export interface CriteriosDaBusca {
  grupo: Grupo;
  /** Destinos to search; every Saída of their Pacotes is a candidate. */
  destinos: Destino[];
  /** First and last start date allowed, inclusive; `fim` absent means no limit. */
  inicio: string;
  fim?: string;
  /** Maximum total for the whole Grupo, in centavos. */
  orcamento?: number;
}

/**
 * The cheapest Cotação of each Pacote among the Saídas that pass every
 * filter, with the other passing dates, cheapest Pacote first. When none
 * passes, a diagnóstico counts why the Saídas in the janela fell out.
 */
export function buscar(catalogo: DadosDoCatalogo, criterios: CriteriosDaBusca) {
  const { grupo, inicio, fim, orcamento } = criterios;
  const slugsDosDestinos = new Set(criterios.destinos.map((d) => d.slug));
  const slugsDosHoteis = new Set(
    catalogo.hoteis
      .filter((h) => slugsDosDestinos.has(h.destino))
      .map((h) => h.slug),
  );
  const pacotes = catalogo.pacotes.filter((p) => slugsDosHoteis.has(p.hotel));
  // Each Saída counts under the first filter it fails, in this order.
  const diagnostico = {
    saidasNaJanela: 0,
    foraDoOrcamento: 0,
    /** Cheapest total among the Saídas that fell only for the orçamento. */
    menorPreco: null as number | null,
    semVagas: 0,
    grupoNaoAceito: 0,
  };

  const porPacote: Array<Cotacao & { outrasSaidas: string[] }> = [];
  for (const pacote of pacotes) {
    const naJanela = catalogo.saidas.filter(
      (s) =>
        s.pacote === pacote.slug &&
        s.data >= inicio &&
        (fim === undefined || s.data <= fim),
    );
    diagnostico.saidasNaJanela += naJanela.length;
    if (recusaDoGrupo(pacote, grupo)) {
      diagnostico.grupoNaoAceito += naJanela.length;
      continue;
    }
    const validas: Cotacao[] = [];
    for (const saida of naJanela) {
      const { ok: _, ...cotacao } = cotar(catalogo, pacote, saida, grupo);
      if (cotacao.vagasRestantes < cotacao.vagasDoGrupo) {
        diagnostico.semVagas++;
      } else if (orcamento !== undefined && cotacao.total > orcamento) {
        diagnostico.foraDoOrcamento++;
        diagnostico.menorPreco = Math.min(
          diagnostico.menorPreco ?? cotacao.total,
          cotacao.total,
        );
      } else {
        validas.push(cotacao);
      }
    }
    // Saídas come in date order, so a tie keeps the earliest date.
    const maisBarata = validas.reduce<Cotacao | undefined>(
      (menor, c) => (!menor || c.total < menor.total ? c : menor),
      undefined,
    );
    if (!maisBarata) continue;
    porPacote.push({
      ...maisBarata,
      outrasSaidas: validas.filter((c) => c !== maisBarata).map((c) => c.data),
    });
  }

  if (porPacote.length === 0) {
    return { ok: true as const, cotacoes: [], diagnostico };
  }
  const cotacoes = porPacote
    .sort(
      (a, b) =>
        a.total - b.total ||
        (a.data < b.data ? -1 : a.data > b.data ? 1 : 0) ||
        (a.pacote.slug < b.pacote.slug ? -1 : 1),
    )
    .slice(0, MAXIMO_DE_RESULTADOS);
  return { ok: true as const, cotacoes };
}

/**
 * The Destinos whose name matches `nome` ignoring case and accents, or every
 * Destino when `nome` is absent. Empty means the Destino is unknown.
 */
export function destinosDaBusca(
  destinos: Destino[],
  nome: string | undefined,
): Destino[] {
  if (nome === undefined) return destinos;
  return destinos.filter(
    (d) => normalizarNome(d.nome) === normalizarNome(nome),
  );
}

/** Lowercase without diacritics, so "florianopolis" finds "Florianópolis". */
function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
