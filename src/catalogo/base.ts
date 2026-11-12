import { IDADE_ADULTA } from "./grupo";
import type {
  DadosDoCatalogo,
  FaixaDeIdade,
  PeriodoTarifario,
  PoliticaDeCriancas,
} from "./tipos";

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

function porIdade(faixas: FaixaDeIdade[]): FaixaDeIdade[] {
  return [...faixas].sort((a, b) => a.idadeMinima - b.idadeMinima);
}

function ordenarPolitica(politica: PoliticaDeCriancas): PoliticaDeCriancas {
  return politica.aceitaCriancas
    ? { aceitaCriancas: true, faixas: porIdade(politica.faixas) }
    : politica;
}

/** Orders the catalog the way every Base do Catálogo must return it. */
function ordenarCatalogo(dados: DadosDoCatalogo): DadosDoCatalogo {
  const porSlug = <T extends { slug: string }>(lista: T[]) =>
    [...lista].sort((a, b) => compararTexto(a.slug, b.slug));
  return {
    destinos: porSlug(dados.destinos),
    hoteis: porSlug(dados.hoteis),
    pacotes: porSlug(dados.pacotes).map((pacote) => ({
      ...pacote,
      politicaDeCriancas: ordenarPolitica(pacote.politicaDeCriancas),
    })),
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

/**
 * Throws when `dados` breaks a rule the domain relies on but storage alone
 * would not enforce. Every Base checks it before taking a catalog in.
 */
export function conferirCatalogo(dados: DadosDoCatalogo): void {
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
  for (const pacote of dados.pacotes) {
    const problema = problemaDaPolitica(pacote.politicaDeCriancas);
    if (problema) {
      throw new Error(
        `Política de Crianças do Pacote ${pacote.slug}: ${problema}`,
      );
    }
  }
}

/** Pricing needs exactly one faixa for each child age, 0 to IDADE_ADULTA − 1. */
function problemaDaPolitica(politica: PoliticaDeCriancas): string | undefined {
  if (!politica.aceitaCriancas) return undefined;
  let proximaIdade = 0;
  for (const faixa of porIdade(politica.faixas)) {
    const { idadeMinima, idadeMaxima, percentual } = faixa;
    if (!Number.isInteger(percentual) || percentual < 0 || percentual > 100) {
      return `percentual ${percentual} não é um inteiro de 0 a 100`;
    }
    if (idadeMinima !== proximaIdade || idadeMaxima < idadeMinima) {
      return `a faixa ${idadeMinima}–${idadeMaxima} deixa um buraco ou se sobrepõe a outra (esperava começar em ${proximaIdade})`;
    }
    proximaIdade = idadeMaxima + 1;
  }
  if (proximaIdade !== IDADE_ADULTA) {
    return `as faixas cobrem de 0 a ${proximaIdade - 1}, e precisam cobrir de 0 a ${IDADE_ADULTA - 1}`;
  }
  return undefined;
}

export function criarBaseEmMemoria(dados: DadosDoCatalogo): BaseDoCatalogo {
  conferirCatalogo(dados);
  // Copied on the way in and out, so no caller can change the stored catalog.
  const catalogo = ordenarCatalogo(structuredClone(dados));
  return {
    async lerCatalogo() {
      return structuredClone(catalogo);
    },
  };
}
