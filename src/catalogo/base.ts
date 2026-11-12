import type { DadosDoCatalogo, PeriodoTarifario } from "./tipos";

/**
 * Base do Catálogo: everything the catalog module needs from storage, and
 * nothing more (see docs/adr/0001). Domain rules stay in the module, so the
 * in-memory and Postgres implementations give the same results.
 */
export interface BaseDoCatalogo {
  lerCatalogo(): Promise<DadosDoCatalogo>;
}

/** Code-point order: no locale rules, so every implementation sorts the same way. */
function compararTexto(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A feriado has no Destino; the empty string sorts it before any temporada. */
function destinoDoPeriodo(periodo: PeriodoTarifario): string {
  return periodo.tipo === "temporada" ? periodo.destino : "";
}

/** Orders the catalog the way every Base do Catálogo must return it. */
function ordenarCatalogo(dados: DadosDoCatalogo): DadosDoCatalogo {
  const porSlug = <T extends { slug: string }>(lista: T[]) =>
    [...lista].sort((a, b) => compararTexto(a.slug, b.slug));
  return {
    destinos: porSlug(dados.destinos),
    hoteis: porSlug(dados.hoteis),
    pacotes: porSlug(dados.pacotes),
    saidas: [...dados.saidas].sort(
      (a, b) =>
        compararTexto(a.pacote, b.pacote) || compararTexto(a.data, b.data),
    ),
    periodos: [...dados.periodos].sort(
      (a, b) =>
        compararTexto(a.inicio, b.inicio) ||
        compararTexto(a.nome, b.nome) ||
        compararTexto(destinoDoPeriodo(a), destinoDoPeriodo(b)),
    ),
  };
}

export function criarBaseEmMemoria(dados: DadosDoCatalogo): BaseDoCatalogo {
  // Postgres stores fatores as numeric(4,2) and would silently round a third
  // decimal, so both Bases accept only fatores with up to two decimals.
  for (const periodo of dados.periodos) {
    const emCentesimos = periodo.fator * 100;
    if (Math.abs(emCentesimos - Math.round(emCentesimos)) > 1e-9) {
      throw new Error(
        `Fator ${periodo.fator} do Período "${periodo.nome}" tem mais de duas casas decimais`,
      );
    }
  }
  // Copied on the way in and out, so no caller can change the stored catalog.
  const catalogo = ordenarCatalogo(structuredClone(dados));
  return {
    async lerCatalogo() {
      return structuredClone(catalogo);
    },
  };
}
