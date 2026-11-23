import {
  type LanguageModel,
  readUIMessageStream,
  type UIMessage,
  wrapLanguageModel,
} from "ai";
import {
  cardsDaResposta,
  chamadasDaResposta,
  criarAssistente,
  criarBaseDeConversasEmMemoria,
  criarLimitadorEmMemoria,
  mensagensDe,
} from "../assistente";
import {
  type Embedar,
  type IndiceDosTrechos,
  type Relogio,
  relogioFixo,
} from "../catalogo";
import {
  type Caso,
  type Casos,
  type Categoria,
  eaCotacaoEsperada,
  pacoteESaida,
} from "./caso";
import { fabricaDeCatalogos } from "./catalogo-da-avaliacao";
import { type ValorInventado, valoresInventados } from "./valores-inventados";

/** Each category passes with at least this share of its Casos right, in percent. */
export const PISO_POR_CATEGORIA = 80;

/** A model the Avaliação can wrap: a provider's object, never a bare id. */
type Modelo = Exclude<LanguageModel, string>;

/** What became of one Caso, as the Avaliação keeps it. */
export interface ResultadoDoCaso {
  caso: string;
  categoria: Categoria;
  modelo: string;
  rodouEm: Date;
  aprovado: boolean;
  /** Why it failed, readable; empty when it passed. */
  motivos: string[];
  /** Any one of them fails the whole Avaliação. */
  valoresInventados: ValorInventado[];
}

/** Where the Avaliação keeps each Caso's result as soon as it has it. */
export interface ResultadosDaAvaliacao {
  gravar(resultado: ResultadoDoCaso): Promise<void>;
}

export interface PlacarDaCategoria {
  categoria: Categoria;
  acertos: number;
  total: number;
  /** Of the Casos right, rounded down to a whole percent. */
  percentual: number;
  piso: number;
  aprovada: boolean;
}

/** The outcome of an Avaliação: the score, and why each failed Caso failed. */
export interface Relatorio {
  modelo: string;
  geradoEm: Date;
  /** False on any Valor inventado, or with a category under its piso. */
  aprovada: boolean;
  categorias: PlacarDaCategoria[];
  /** Tolerância zero: the Casos whose answer had a Valor inventado. */
  valoresInventados: { caso: string; valores: ValorInventado[] }[];
  reprovados: { caso: string; motivos: string[] }[];
}

/** Who sends the Casos' messages. Each Caso opens its own Conversa. */
const VIAJANTE_DA_AVALIACAO = "avaliacao";

/** The search for Pacotes: calling it is how the model checks that none serves. */
const BUSCA_DE_PACOTES = "buscar_pacotes";

/**
 * Runs each Caso once, in a new Conversa, against the Assistente with the
 * catalog of `semente.ts` in memory and the Relógio fixed at `casos.agora`,
 * and scores the answers by what the Ferramentas returned (docs/adr/0007).
 * Each result goes to `resultados` as soon as its Caso ends. `esperar` runs
 * before every model call but the first, so the provider's quota per minute
 * holds; `relogio` dates the results and the Relatório.
 */
export async function avaliar({
  casos,
  modelo,
  embeddings,
  resultados,
  esperar,
  relogio,
}: {
  casos: Casos;
  modelo: {
    /** How the Relatório names it, e.g. `google:gemini-3.8-flash`. */
    nome: string;
    /** The model that answers `caso`: the same real one for every Caso, or a scripted fake. */
    para(caso: Caso): Modelo;
  };
  /**
   * Embeds the question the model sends to buscar_politicas. `indice` must
   * be the model the Trechos' vectors were recorded with.
   */
  embeddings: { indice: IndiceDosTrechos; embedarPergunta: Embedar };
  resultados: ResultadosDaAvaliacao;
  esperar: () => Promise<void>;
  relogio: Relogio;
}): Promise<Relatorio> {
  const relogioDosCasos = relogioFixo(casos.agora);
  const novoCatalogo = await fabricaDeCatalogos({
    embeddings,
    relogio: relogioDosCasos,
  });

  let chamadasAoModelo = 0;
  const antesDeChamar = async () => {
    if (chamadasAoModelo++ > 0) await esperar();
  };
  const comEspera = (m: Modelo) =>
    wrapLanguageModel({
      model: m,
      middleware: {
        specificationVersion: "v4",
        wrapGenerate: async ({ doGenerate }) => {
          await antesDeChamar();
          return doGenerate();
        },
        wrapStream: async ({ doStream }) => {
          await antesDeChamar();
          return doStream();
        },
      },
    });

  const todos: ResultadoDoCaso[] = [];
  for (const caso of casos.lista) {
    const conversas = criarBaseDeConversasEmMemoria();
    const assistente = criarAssistente({
      modelo: comEspera(modelo.para(caso)),
      catalogo: novoCatalogo(),
      conversas,
      relogio: relogioDosCasos,
      limitador: criarLimitadorEmMemoria(),
      limites: {
        porOrigemPorHora: Number.POSITIVE_INFINITY,
        globalPorDia: Number.POSITIVE_INFINITY,
      },
    });
    const resposta = await responder(assistente, caso, conversas);
    const inventados = resposta.ok
      ? valoresInventados(resposta.mensagem, resposta.conversa)
      : [];
    const motivos = resposta.ok
      ? [
          ...motivosDoPreco(caso, resposta.mensagem),
          ...inventados.map((v) => `Valor inventado: ${v.texto}`),
        ]
      : [resposta.motivo];
    const resultado: ResultadoDoCaso = {
      caso: caso.id,
      categoria: caso.categoria,
      modelo: modelo.nome,
      rodouEm: relogio.agora(),
      aprovado: motivos.length === 0,
      motivos,
      valoresInventados: inventados,
    };
    await resultados.gravar(resultado);
    todos.push(resultado);
  }
  return relatorioDe(todos, modelo.nome, relogio.agora());
}

/**
 * Sends the Caso's message and reads the whole answer back from the
 * Conversa, as it was recorded.
 */
async function responder(
  assistente: ReturnType<typeof criarAssistente>,
  caso: Caso,
  conversas: ReturnType<typeof criarBaseDeConversasEmMemoria>,
): Promise<
  | { ok: true; mensagem: UIMessage; conversa: UIMessage[] }
  | { ok: false; motivo: string }
> {
  const envio = await assistente.enviarMensagem({
    dono: VIAJANTE_DA_AVALIACAO,
    origem: VIAJANTE_DA_AVALIACAO,
    texto: caso.mensagem,
  });
  if (!envio.ok) {
    return { ok: false, motivo: `a mensagem foi recusada: ${envio.erro}` };
  }
  try {
    for await (const _ of readUIMessageStream({
      stream: envio.stream,
      terminateOnError: true,
    })) {
      // Only the recorded answer counts; reading the stream lets it end.
    }
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro);
    return { ok: false, motivo: `o Assistente não respondeu: ${detalhe}` };
  }
  const conversa = mensagensDe(await conversas.lerItens(envio.conversa));
  const mensagem = conversa.at(-1);
  if (mensagem?.role !== "assistant") {
    return { ok: false, motivo: "o Assistente não respondeu" };
  }
  return { ok: true, mensagem, conversa };
}

/** Why the cards of `resposta` miss what the price Caso expects; empty when they match. */
function motivosDoPreco(caso: Caso, resposta: UIMessage): string[] {
  const cards = cardsDaResposta(resposta);
  const { esperado } = caso;
  if ("nenhumPacote" in esperado) {
    if (cards.length > 0) {
      return [
        `esperava nenhum Pacote, os cards trouxeram ${listar(cards.map(descreverCotacao))}`,
      ];
    }
    const buscou = chamadasDaResposta(resposta).some(
      (c) => c.ferramenta === BUSCA_DE_PACOTES,
    );
    return buscou
      ? []
      : ["esperava nenhum Pacote, mas nenhuma Ferramenta de busca foi chamada"];
  }
  if (cards.some((c) => eaCotacaoEsperada(c, esperado))) return [];
  const trouxeram =
    cards.length === 0
      ? "nenhum card veio"
      : `os cards trouxeram ${listar(cards.map(descreverCotacao))}`;
  return [`esperava a Cotação ${descreverCotacao(esperado)}, ${trouxeram}`];
}

function descreverCotacao(c: Parameters<typeof pacoteESaida>[0]): string {
  return `${pacoteESaida(c)} por ${emReais(c.total)}`;
}

const REAIS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 578000 → "R$ 5.780,00", with a plain space. */
function emReais(centavos: number): string {
  return REAIS.format(centavos / 100).replace(/\s/u, " ");
}

/** "A", "A e B", "A, B e C". */
function listar(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

function relatorioDe(
  resultados: ResultadoDoCaso[],
  modelo: string,
  geradoEm: Date,
): Relatorio {
  const categorias = [...new Set(resultados.map((r) => r.categoria))].map(
    (categoria): PlacarDaCategoria => {
      const daCategoria = resultados.filter((r) => r.categoria === categoria);
      const acertos = daCategoria.filter((r) => r.aprovado).length;
      const total = daCategoria.length;
      return {
        categoria,
        acertos,
        total,
        percentual: Math.floor((acertos * 100) / total),
        piso: PISO_POR_CATEGORIA,
        aprovada: acertos * 100 >= PISO_POR_CATEGORIA * total,
      };
    },
  );
  const inventados = resultados
    .filter((r) => r.valoresInventados.length > 0)
    .map((r) => ({ caso: r.caso, valores: r.valoresInventados }));
  return {
    modelo,
    geradoEm,
    aprovada: inventados.length === 0 && categorias.every((c) => c.aprovada),
    categorias,
    valoresInventados: inventados,
    reprovados: resultados
      .filter((r) => !r.aprovado)
      .map((r) => ({ caso: r.caso, motivos: r.motivos })),
  };
}
