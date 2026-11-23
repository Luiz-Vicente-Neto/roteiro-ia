// Reads an Assistente answer for the screen. Nothing from the server side, so the browser can import it.
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type {
  Cotacao,
  Falha,
  NomeDeFerramenta,
  ResultadoDe,
  TrechoDaBusca,
} from "../catalogo";

/** A card's Cotação: from buscar_pacotes it also lists the other dates that fit. */
export type CotacaoDoCard = Cotacao & { outrasSaidas?: string[] };

interface ChamadaDeFerramenta {
  id: string;
  entrada: unknown;
}

/** A call that worked: `saida` is the result its Ferramenta types. */
export type ChamadaQueDeuCerto = {
  [N in NomeDeFerramenta]: ChamadaDeFerramenta & {
    ferramenta: N;
    ok: true;
    saida: Extract<ResultadoDe<N>, { ok: true }>;
  };
}[NomeDeFerramenta];

/**
 * A call that failed: the catalog's Falha, or the error text of a call the SDK
 * refused, even one to a Ferramenta that does not exist.
 */
export interface ChamadaQueFalhou extends ChamadaDeFerramenta {
  ferramenta: string;
  ok: false;
  saida: Falha | string;
}

/**
 * One tool call of an answer, as the "como cheguei nessa resposta" panel shows
 * it. Narrow by `ok`, then by `ferramenta`, to read `saida` typed.
 */
export type Chamada = ChamadaQueDeuCerto | ChamadaQueFalhou;

type Parte = UIMessage["parts"][number];

/** The finished tool calls of `mensagem`, in the order the model made them. */
export function chamadasDaResposta(mensagem: UIMessage): Chamada[] {
  return mensagem.parts.flatMap((parte: Parte): Chamada[] => {
    if (!isToolUIPart(parte)) return [];
    const base = {
      id: parte.toolCallId,
      ferramenta: getToolName(parte),
      entrada: parte.input,
    };
    if (parte.state === "output-available") {
      // The one place that trusts the stored history: the catalog is the only
      // source of a tool's result, so it has the shape its Ferramenta types.
      return deuCerto(parte.output)
        ? [{ ...base, ok: true, saida: parte.output } as ChamadaQueDeuCerto]
        : [{ ...base, ok: false, saida: parte.output as Falha }];
    }
    if (parte.state === "output-error") {
      return [{ ...base, ok: false, saida: parte.errorText }];
    }
    return [];
  });
}

/**
 * The Cotações shown as cards, read from the tool results and never from the
 * model's text, so the numbers are exactly the catalog's. Only the last
 * buscar_pacotes counts (earlier ones were steps along the way and stay in the
 * panel), and each consultar_preco adds its Cotação. The same Cotação found
 * twice shows once, where it was found last.
 */
export function cardsDaResposta(mensagem: UIMessage): CotacaoDoCard[] {
  const chamadas = chamadasDaResposta(mensagem);
  const ultimaBusca = chamadas.findLast(
    (c) => c.ferramenta === "buscar_pacotes",
  );
  const cards: CotacaoDoCard[] = [];
  for (const chamada of chamadas) {
    if (!chamada.ok) continue;
    if (chamada.ferramenta === "buscar_pacotes") {
      if (chamada === ultimaBusca) cards.push(...chamada.saida.cotacoes);
    } else if (chamada.ferramenta === "consultar_preco") {
      const { ok: _, ...cotacao } = chamada.saida;
      cards.push(cotacao);
    }
  }
  const chaves = cards.map(chaveDoCard);
  return cards.filter((_, i) => chaves.lastIndexOf(chaves[i] ?? "") === i);
}

/** What makes two cards the same Cotação: the Saída and the Grupo. */
export function chaveDoCard({ pacote, data, grupo }: CotacaoDoCard): string {
  return `${pacote.slug}:${data}:${grupo.adultos}:${grupo.criancas.join(",")}`;
}

/**
 * True for a consultar_preco Cotação, the one the Viajante asked about
 * directly: its card also shows the price of each person and the Período
 * Tarifário. Only buscar_pacotes lists the other Saídas.
 */
export function cardDetalhado(card: CotacaoDoCard): boolean {
  return !("outrasSaidas" in card);
}

/** A Proposta of an answer, as propor_pre_reserva gave it to the model. */
export interface PropostaDoCard {
  id: string;
  cotacao: Cotacao;
  /** ISO instant until which it can be confirmed. */
  expiraEm: string;
}

/**
 * Where a Proposta's card stands, always read again from the catalog and the
 * Conversa's Eventos, never stored in the message. "erro" is not here: it is
 * only the answer to a click that failed.
 */
export type EstadoDaProposta =
  | { estado: "valida"; expiraEm: string }
  | { estado: "expirada" }
  | { estado: "descartada" }
  /** `bloqueadaAte`: ISO instant until which the Pré-reserva holds the Vagas. */
  | { estado: "confirmada"; codigo: string; bloqueadaAte: string };

/**
 * The Propostas the model made in `mensagem`, one card each, read from the
 * tool results. Their state is not here: it is always read again from the
 * catalog (see EstadoDaProposta).
 */
export function propostasDaResposta(mensagem: UIMessage): PropostaDoCard[] {
  return chamadasDaResposta(mensagem).flatMap((chamada) => {
    if (!chamada.ok || chamada.ferramenta !== "propor_pre_reserva") return [];
    const { id, cotacao, expiraEm } = chamada.saida;
    return [{ id, cotacao, expiraEm }];
  });
}

/** A Citação the screen shows as the footnote `[numero]`. */
export interface Citacao {
  numero: number;
  /** As kept in the Conversa's history: the text the Assistente read then. */
  trecho: TrechoDaBusca;
}

/** One piece of an answer's text: plain text, or the place of a Citação. */
export type PedacoDoTexto =
  | { tipo: "texto"; texto: string }
  | { tipo: "citacao"; numero: number };

/** An answer's text with its Citações read, as the screen shows it. */
export interface TextoDaResposta {
  pedacos: PedacoDoTexto[];
  /** By `numero`, from 1. */
  citacoes: Citacao[];
}

const INICIO_DO_MARCADOR = "[[trecho:";

/**
 * How the model marks a Citação in its text: the Trecho's stable id inside
 * `[[trecho:…]]`. The system prompt shows the model this same format.
 */
export function marcadorDeCitacao(idDoTrecho: string): string {
  return `${INICIO_DO_MARCADOR}${idDoTrecho}]]`;
}

/**
 * Any `[[trecho:…]]`, even a badly written one, so none reaches the screen.
 * The spaces before it go too, so the note sits on the word.
 */
const MARCADOR = /\s*\[\[trecho:\s*([^\]]*?)\s*\]\]/g;

/**
 * Reads the Citações of `mensagem`. A marker counts only when its id came back
 * from a buscar_politicas of the same Conversa, in `mensagem` or before it in
 * `conversa` (the whole Conversa, or the messages before `mensagem`); the
 * others leave the text. Numbers follow the order of
 * appearance, and the same Trecho keeps its number. The quoted text is the one
 * kept in the history, the one the Assistente read then.
 */
export function textoDaResposta(
  mensagem: UIMessage,
  conversa: UIMessage[],
): TextoDaResposta {
  const consultados = trechosAte(mensagem, conversa);
  const pedacos: PedacoDoTexto[] = [];
  const citacoes: Citacao[] = [];
  const texto = textoDaMensagem(mensagem);
  let desde = 0;
  for (const marcador of texto.matchAll(MARCADOR)) {
    acrescentarTexto(pedacos, texto.slice(desde, marcador.index));
    desde = marcador.index + marcador[0].length;
    const trecho = consultados.get(marcador[1] ?? "");
    if (!trecho) continue;
    let citacao = citacoes.find((c) => c.trecho.id === trecho.id);
    if (!citacao) {
      citacao = { numero: citacoes.length + 1, trecho };
      citacoes.push(citacao);
    }
    pedacos.push({ tipo: "citacao", numero: citacao.numero });
  }
  acrescentarTexto(pedacos, semMarcadorPelaMetade(texto.slice(desde)));
  return { pedacos, citacoes };
}

/**
 * While the answer streams, its end may be a marker still being written:
 * hidden until it closes, so the Viajante never sees `[[trech`.
 */
function semMarcadorPelaMetade(texto: string): string {
  const inicio = texto.lastIndexOf("[[");
  if (inicio === -1) return texto;
  const resto = texto.slice(inicio);
  const pelaMetade =
    !resto.includes("]]") &&
    (resto.startsWith(INICIO_DO_MARCADOR) ||
      INICIO_DO_MARCADOR.startsWith(resto));
  return pelaMetade ? texto.slice(0, inicio).trimEnd() : texto;
}

/** Joins with the previous text piece, so a removed marker leaves no seam. */
function acrescentarTexto(pedacos: PedacoDoTexto[], texto: string): void {
  if (!texto) return;
  const ultimo = pedacos.at(-1);
  if (ultimo?.tipo === "texto") ultimo.texto += texto;
  else pedacos.push({ tipo: "texto", texto });
}

/**
 * The Trechos buscar_politicas returned in `conversa` up to `mensagem`, and in
 * `mensagem` itself, by id. A later result of the same Trecho wins.
 */
function trechosAte(
  mensagem: UIMessage,
  conversa: UIMessage[],
): Map<string, TrechoDaBusca> {
  const ate = conversa.findIndex((m) => m.id === mensagem.id);
  const lidas = [...(ate === -1 ? conversa : conversa.slice(0, ate)), mensagem];
  return new Map(
    lidas
      .flatMap(chamadasDaResposta)
      .flatMap(trechosDaChamada)
      .map((t) => [t.id, t] as const),
  );
}

/** The Trechos one call returned: none unless it is a buscar_politicas that worked. */
export function trechosDaChamada(chamada: Chamada): TrechoDaBusca[] {
  if (!chamada.ok || chamada.ferramenta !== "buscar_politicas") return [];
  return chamada.saida.trechos;
}

/** All the text of a message, as written: markers and all. */
export function textoDaMensagem(mensagem: UIMessage | undefined): string {
  if (!mensagem) return "";
  return mensagem.parts
    .flatMap((p) => (p.type === "text" ? [p.text] : []))
    .join("");
}

function deuCerto(saida: unknown): boolean {
  return (
    typeof saida === "object" &&
    saida !== null &&
    (saida as { ok?: unknown }).ok === true
  );
}
