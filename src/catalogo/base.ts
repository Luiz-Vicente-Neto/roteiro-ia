import type { DadosDoCatalogo } from "./tipos";

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
  };
}

export function criarBaseEmMemoria(dados: DadosDoCatalogo): BaseDoCatalogo {
  // Copied on the way in and out, so no caller can change the stored catalog.
  const catalogo = ordenarCatalogo(structuredClone(dados));
  return {
    async lerCatalogo() {
      return structuredClone(catalogo);
    },
  };
}
