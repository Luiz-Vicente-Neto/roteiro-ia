import { IDADE_ADULTA } from "./grupo";
import type {
  DadosDoCatalogo,
  FaixaDeIdade,
  PeriodoTarifario,
  PoliticaDeCriancas,
  PreReserva,
  Proposta,
  VagasOcupadas,
} from "./tipos";
import { chaveDaSaida, vagasDoGrupo } from "./vagas";

/** What a Base answers when it refuses to make a Pré-reserva. */
export type RecusaDaPreReserva =
  | { ok: false; motivo: "PROPOSTA_JA_CONFIRMADA" }
  | { ok: false; motivo: "CODIGO_EM_USO" }
  | { ok: false; motivo: "VAGAS_INSUFICIENTES"; vagasRestantes: number };

/**
 * Base do Catálogo: everything the catalog module needs from storage, and
 * nothing more (see docs/adr/0001). Domain rules stay in the module, so the
 * in-memory and Postgres implementations give the same results.
 */
export interface BaseDoCatalogo {
  lerCatalogo(): Promise<DadosDoCatalogo>;
  /** Records a new Proposta under its id, which the caller guarantees is new. */
  gravarProposta(proposta: Proposta): Promise<void>;
  /** The Proposta with `id`, or undefined if none was recorded. Expired ones too: expiry is the module's rule. */
  lerProposta(id: string): Promise<Proposta | undefined>;
  /** Vagas held on each Saída by the Pré-reservas still active at `agora` (`expiraEm` after it). Saídas with none are left out. */
  lerVagasOcupadas(agora: Date): Promise<VagasOcupadas[]>;
  /** The Pré-reserva made from the Proposta `idDaProposta`, expired or not, or undefined if none was made. */
  lerPreReservaDaProposta(
    idDaProposta: string,
  ): Promise<PreReserva | undefined>;
  /**
   * Atomically: checks that the Proposta `idDaProposta` (which must exist) is
   * not confirmed yet, that `preReserva.codigo` is unused, and that the Grupo
   * fits the Vagas of the Saída left by the Pré-reservas active at `agora`;
   * then records the Pré-reserva and marks the Proposta confirmed. Either all
   * of it happens or none does, even under concurrent calls.
   */
  criarPreReserva(pedido: {
    idDaProposta: string;
    preReserva: PreReserva;
    agora: Date;
  }): Promise<{ ok: true } | RecusaDaPreReserva>;
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
  const propostas = new Map<string, Proposta>();
  const preReservas = new Map<string, PreReserva>();
  // The código of the Pré-reserva made from each confirmed Proposta.
  const codigoDaProposta = new Map<string, string>();
  const ativas = (agora: Date) =>
    [...preReservas.values()].filter((p) => p.expiraEm > agora);
  return {
    async lerCatalogo() {
      return structuredClone(catalogo);
    },
    async gravarProposta(proposta) {
      propostas.set(proposta.id, structuredClone(proposta));
    },
    async lerProposta(id) {
      const proposta = propostas.get(id);
      return proposta && structuredClone(proposta);
    },
    async lerVagasOcupadas(agora) {
      const porSaida = new Map<string, VagasOcupadas>();
      for (const { pacote, data, grupo } of ativas(agora)) {
        const chave = chaveDaSaida(pacote, data);
        const ocupadas = porSaida.get(chave) ?? { pacote, data, vagas: 0 };
        ocupadas.vagas += vagasDoGrupo(grupo);
        porSaida.set(chave, ocupadas);
      }
      return [...porSaida.values()];
    },
    async lerPreReservaDaProposta(idDaProposta) {
      const codigo = codigoDaProposta.get(idDaProposta);
      const preReserva = codigo && preReservas.get(codigo);
      return preReserva ? structuredClone(preReserva) : undefined;
    },
    // Nothing is awaited in here, so no other call can run in between: that
    // is what makes it atomic in memory.
    async criarPreReserva({ idDaProposta, preReserva, agora }) {
      const proposta = propostas.get(idDaProposta);
      if (!proposta) throw new Error(`Proposta ${idDaProposta} não existe`);
      if (proposta.confirmada) {
        return { ok: false, motivo: "PROPOSTA_JA_CONFIRMADA" };
      }
      if (preReservas.has(preReserva.codigo)) {
        return { ok: false, motivo: "CODIGO_EM_USO" };
      }
      const { pacote, data } = preReserva;
      const saida = catalogo.saidas.find(
        (s) => s.pacote === pacote && s.data === data,
      );
      if (!saida) throw new Error(`Saída ${pacote} ${data} não existe`);
      const ocupadas = ativas(agora)
        .filter((p) => p.pacote === pacote && p.data === data)
        .reduce((soma, p) => soma + vagasDoGrupo(p.grupo), 0);
      const vagasRestantes = saida.vagasTotais - ocupadas;
      if (vagasDoGrupo(preReserva.grupo) > vagasRestantes) {
        return { ok: false, motivo: "VAGAS_INSUFICIENTES", vagasRestantes };
      }
      preReservas.set(preReserva.codigo, structuredClone(preReserva));
      codigoDaProposta.set(idDaProposta, preReserva.codigo);
      proposta.confirmada = true;
      return { ok: true };
    },
  };
}
