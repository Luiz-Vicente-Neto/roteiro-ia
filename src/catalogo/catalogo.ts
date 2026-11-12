import type { BaseDoCatalogo } from "./base";
import { buscar, destinosDaBusca } from "./busca";
import {
  type EntradaBuscarPacotes,
  type EntradaConsultarPreco,
  type EntradaProporPreReserva,
  type EntradaVerificarDisponibilidade,
  entradaBuscarPacotes,
  entradaConsultarPreco,
  entradaVerificarDisponibilidade,
  validar,
} from "./entradas";
import { falha } from "./erros";
import { criarFerramentas } from "./ferramentas";
import { recusaDoGrupo } from "./grupo";
import { gerarCodigoDaPreReserva } from "./pre-reserva";
import { cotar } from "./preco";
import { gerarIdDaProposta } from "./proposta";
import type { Relogio } from "./relogio";
import type { DadosDoCatalogo, PreReserva } from "./tipos";
import { type CatalogoVigente, ocupacao, vagasRestantes } from "./vagas";

const SUGESTOES_DE_SAIDA = 3;

/** A Proposta can be confirmed for 15 minutes after it is made. */
const VALIDADE_DA_PROPOSTA_MS = 15 * 60 * 1000;

/** A Pré-reserva holds its Vagas for 24 hours after it is made. */
const VALIDADE_DA_PRE_RESERVA_MS = 24 * 60 * 60 * 1000;

/** A collision among 32⁴ codes is rare; this many in a row means a bug. */
const TENTATIVAS_DE_CODIGO = 5;

/** ISO dates closest to `alvo` (ties go to the earlier one), returned in date order. */
function datasMaisProximas(datas: string[], alvo: string): string[] {
  const dia = (data: string) => Date.parse(`${data}T00:00:00Z`);
  const distancia = (data: string) => Math.abs(dia(data) - dia(alvo));
  return [...datas]
    .sort((a, b) => distancia(a) - distancia(b) || (a < b ? -1 : 1))
    .slice(0, SUGESTOES_DE_SAIDA)
    .sort();
}

/**
 * Finds the Saída of `entrada` in the catalog, or the error the model gets
 * when the Pacote is unknown, the date is not one of its Saídas, or it is past.
 */
function encontrarSaida(
  { pacotes, saidas }: DadosDoCatalogo,
  entrada: { pacote: string; data: string },
  hoje: string,
) {
  const pacote = pacotes.find((p) => p.slug === entrada.pacote);
  if (!pacote) {
    return falha(
      "PACOTE_DESCONHECIDO",
      `Não existe Pacote com o slug "${entrada.pacote}". Use o slug exato de um Pacote do catálogo, como aparece nos resultados de buscar_pacotes.`,
    );
  }
  const doPacote = saidas.filter((s) => s.pacote === entrada.pacote);
  const proximas = datasMaisProximas(
    doPacote.filter((s) => s.data >= hoje).map((s) => s.data),
    entrada.data,
  );
  const saida = doPacote.find((s) => s.data === entrada.data);
  if (saida && saida.data < hoje) {
    return falha(
      "SAIDA_ENCERRADA",
      `A Saída de ${entrada.data} do Pacote "${entrada.pacote}" já aconteceu (hoje é ${hoje}). Ofereça uma Saída futura; as mais próximas estão em sugestoes.`,
      proximas,
    );
  }
  if (!saida) {
    return falha(
      "SAIDA_INEXISTENTE",
      proximas.length > 0
        ? `O Pacote "${entrada.pacote}" não tem Saída em ${entrada.data}. As Saídas mais próximas estão em sugestoes; use uma delas.`
        : `O Pacote "${entrada.pacote}" não tem Saída em ${entrada.data}, nem nenhuma outra Saída futura.`,
      proximas,
    );
  }
  return { ok: true as const, pacote, saida };
}

function jaConfirmada() {
  return falha(
    "PROPOSTA_JA_CONFIRMADA",
    "Esta Proposta já foi confirmada: cada Proposta vale para uma única Pré-reserva.",
  );
}

function semVagas(restantes: number, doGrupo: number) {
  return falha(
    "VAGAS_INSUFICIENTES",
    `As Vagas acabaram desde a Proposta: a Saída tem ${restantes} Vagas restantes, e o Grupo tem ${doGrupo} pessoas. Peça outra Saída na conversa.`,
  );
}

export function criarCatalogo({
  base,
  relogio,
}: {
  base: BaseDoCatalogo;
  relogio: Relogio;
}) {
  /** The catalog with the Vagas held by the Pré-reservas active right now. */
  async function lerCatalogoVigente(): Promise<CatalogoVigente> {
    const [dados, ocupadas] = await Promise.all([
      base.lerCatalogo(),
      base.lerVagasOcupadas(relogio.agora()),
    ]);
    return { ...dados, ocupacao: ocupacao(ocupadas) };
  }

  /**
   * Validates and quotes like consultar_preco, also handing back the catalog
   * it read. Every operation that quotes goes through it, so they all fail
   * the same way.
   */
  async function cotarEntrada(bruta: EntradaConsultarPreco) {
    const validacao = validar(entradaConsultarPreco, bruta);
    if (!validacao.ok) return validacao;
    const entrada = validacao.valor;
    const catalogo = await lerCatalogoVigente();
    const encontrada = encontrarSaida(catalogo, entrada, relogio.hoje());
    if (!encontrada.ok) return encontrada;
    const recusa = recusaDoGrupo(encontrada.pacote, entrada.grupo);
    if (recusa) return recusa;
    const cotacao = cotar(
      catalogo,
      encontrada.pacote,
      encontrada.saida,
      entrada.grupo,
    );
    return { ok: true as const, catalogo, cotacao };
  }

  const operacoes = {
    async buscarPacotes(bruta: EntradaBuscarPacotes) {
      const validacao = validar(entradaBuscarPacotes, bruta);
      if (!validacao.ok) return validacao;
      const { grupo, destino, janela, orcamento } = validacao.valor;
      const catalogo = await lerCatalogoVigente();
      const destinos = destinosDaBusca(catalogo.destinos, destino);
      if (destinos.length === 0) {
        const existentes = catalogo.destinos.map((d) => d.nome);
        return falha(
          "DESTINO_DESCONHECIDO",
          `Não existe Destino chamado "${destino}" no catálogo. Os Destinos existentes estão em sugestoes: use um deles, omita destino para buscar em todos, ou explique ao viajante o que existe.`,
          existentes,
        );
      }
      const hoje = relogio.hoje();
      // Past Saídas never qualify, even inside the janela.
      const inicio = janela && janela.inicio > hoje ? janela.inicio : hoje;
      return buscar(catalogo, {
        grupo,
        destinos,
        inicio,
        fim: janela?.fim,
        orcamento,
      });
    },

    async verificarDisponibilidade(bruta: EntradaVerificarDisponibilidade) {
      const validacao = validar(entradaVerificarDisponibilidade, bruta);
      if (!validacao.ok) return validacao;
      const catalogo = await lerCatalogoVigente();
      const encontrada = encontrarSaida(
        catalogo,
        validacao.valor,
        relogio.hoje(),
      );
      if (!encontrada.ok) return encontrada;
      const { saida } = encontrada;
      return {
        ok: true as const,
        pacote: saida.pacote,
        data: saida.data,
        vagasTotais: saida.vagasTotais,
        vagasRestantes: vagasRestantes(catalogo, saida),
      };
    },

    async consultarPreco(bruta: EntradaConsultarPreco) {
      const cotada = await cotarEntrada(bruta);
      return cotada.ok ? cotada.cotacao : cotada;
    },

    async proporPreReserva(bruta: EntradaProporPreReserva) {
      const cotada = await cotarEntrada(bruta);
      if (!cotada.ok) return cotada;
      // The Proposta carries the Cotação without its own `ok`.
      const { ok: _, ...cotacao } = cotada.cotacao;
      const { vagasDoGrupo } = cotacao;
      if (vagasDoGrupo > cotacao.vagasRestantes) {
        const hoje = relogio.hoje();
        const queCabem = cotada.catalogo.saidas
          .filter(
            (s) =>
              s.pacote === cotacao.pacote.slug &&
              s.data >= hoje &&
              s.data !== cotacao.data &&
              vagasRestantes(cotada.catalogo, s) >= vagasDoGrupo,
          )
          .map((s) => s.data);
        const sugestoes = datasMaisProximas(queCabem, cotacao.data);
        const faltam = `A Saída de ${cotacao.data} do Pacote "${cotacao.pacote.slug}" tem ${cotacao.vagasRestantes} Vagas restantes, e o Grupo tem ${vagasDoGrupo} pessoas (cada criança ocupa uma Vaga, mesmo sem pagar).`;
        return falha(
          "VAGAS_INSUFICIENTES",
          sugestoes.length > 0
            ? `${faltam} Ofereça outra Saída; as mais próximas com Vagas para o Grupo estão em sugestoes.`
            : `${faltam} Nenhuma outra Saída futura do Pacote tem Vagas para o Grupo; ofereça outro Pacote.`,
          sugestoes,
        );
      }
      const criadaEm = relogio.agora();
      const proposta = {
        id: gerarIdDaProposta(),
        pacote: cotacao.pacote.slug,
        data: cotacao.data,
        grupo: cotacao.grupo,
        total: cotacao.total,
        criadaEm,
        expiraEm: new Date(criadaEm.getTime() + VALIDADE_DA_PROPOSTA_MS),
        confirmada: false,
      };
      await base.gravarProposta(proposta);
      return {
        ok: true as const,
        id: proposta.id,
        cotacao,
        expiraEm: proposta.expiraEm.toISOString(),
      };
    },
  };

  /**
   * Confirms the Proposta `idDaProposta`, making a Pré-reserva that holds its
   * Vagas. Only the human path calls it (the chat's button, the MCP
   * confirmation request): it is never one of the ferramentas, so the model
   * cannot reserve (docs/adr/0003). Everything is checked again now.
   */
  async function confirmarPreReserva(idDaProposta: string) {
    const proposta = await base.lerProposta(idDaProposta);
    if (!proposta) {
      return falha(
        "PROPOSTA_INEXISTENTE",
        "Esta Proposta não existe. Peça uma nova Proposta na conversa.",
      );
    }
    const agora = relogio.agora();
    if (proposta.expiraEm <= agora) {
      return falha(
        "PROPOSTA_EXPIRADA",
        "Esta Proposta expirou: ela vale 15 minutos. Peça uma nova Proposta na conversa.",
      );
    }
    if (proposta.confirmada) return jaConfirmada();
    const { pacote, data, grupo } = proposta;
    const cotada = await cotarEntrada({ pacote, data, grupo });
    if (!cotada.ok) return cotada;
    const { cotacao } = cotada;
    if (cotacao.total !== proposta.total) {
      return falha(
        "PRECO_ALTERADO",
        `O preço mudou desde a Proposta: era ${proposta.total} centavos e agora é ${cotacao.total}. Peça uma nova Proposta na conversa.`,
      );
    }
    if (cotacao.vagasDoGrupo > cotacao.vagasRestantes) {
      return semVagas(cotacao.vagasRestantes, cotacao.vagasDoGrupo);
    }
    for (let tentativa = 0; tentativa < TENTATIVAS_DE_CODIGO; tentativa++) {
      const preReserva: PreReserva = {
        codigo: gerarCodigoDaPreReserva(),
        pacote,
        data,
        grupo,
        total: proposta.total,
        criadaEm: agora,
        expiraEm: new Date(agora.getTime() + VALIDADE_DA_PRE_RESERVA_MS),
      };
      const criada = await base.criarPreReserva({
        idDaProposta,
        preReserva,
        agora,
      });
      if (criada.ok) {
        return {
          ok: true as const,
          preReserva: {
            ...preReserva,
            criadaEm: preReserva.criadaEm.toISOString(),
            expiraEm: preReserva.expiraEm.toISOString(),
          },
        };
      }
      if (criada.motivo === "PROPOSTA_JA_CONFIRMADA") return jaConfirmada();
      if (criada.motivo === "VAGAS_INSUFICIENTES") {
        return semVagas(criada.vagasRestantes, cotacao.vagasDoGrupo);
      }
    }
    throw new Error(
      `Nenhum código de Pré-reserva livre em ${TENTATIVAS_DE_CODIGO} tentativas`,
    );
  }

  /**
   * Where the Proposta `idDaProposta` stands right now, for the screen that
   * shows it: still valid (until when), expired, or confirmed (with its
   * Pré-reserva). Not one of the ferramentas: the model learns of a
   * confirmation from the Conversa's Eventos.
   */
  async function situacaoDaProposta(idDaProposta: string) {
    const proposta = await base.lerProposta(idDaProposta);
    if (!proposta) {
      return falha(
        "PROPOSTA_INEXISTENTE",
        "Esta Proposta não existe. Peça uma nova Proposta na conversa.",
      );
    }
    if (proposta.confirmada) {
      const preReserva = await base.lerPreReservaDaProposta(idDaProposta);
      if (!preReserva) {
        throw new Error(`Proposta ${idDaProposta} confirmada sem Pré-reserva`);
      }
      return {
        ok: true as const,
        situacao: "confirmada" as const,
        preReserva: {
          codigo: preReserva.codigo,
          expiraEm: preReserva.expiraEm.toISOString(),
        },
      };
    }
    if (proposta.expiraEm <= relogio.agora()) {
      return { ok: true as const, situacao: "expirada" as const };
    }
    return {
      ok: true as const,
      situacao: "valida" as const,
      expiraEm: proposta.expiraEm.toISOString(),
    };
  }

  return {
    ...operacoes,
    confirmarPreReserva,
    situacaoDaProposta,
    ferramentas: criarFerramentas(operacoes),
  };
}

export type Catalogo = ReturnType<typeof criarCatalogo>;
