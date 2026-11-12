// Reads an Assistente answer for the screen. Nothing from the server side, so the browser can import it.
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { Cotacao } from "../catalogo";

/** A card's Cotação: from buscar_pacotes it also lists the other dates that fit. */
export type CotacaoDoCard = Cotacao & { outrasSaidas?: string[] };

/** One tool call of an answer, as the "como cheguei nessa resposta" panel shows it. */
export interface Chamada {
  id: string;
  ferramenta: string;
  /** False when the call failed: the catalog's Falha or an SDK error. */
  ok: boolean;
  entrada: unknown;
  /** The raw result the model received, or the error text. */
  saida: unknown;
}

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
      return [{ ...base, ok: deuCerto(parte.output), saida: parte.output }];
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
    if (chamada === ultimaBusca) {
      // The catalog is the only source of these results (see catalogo/busca.ts).
      cards.push(...(chamada.saida as { cotacoes: CotacaoDoCard[] }).cotacoes);
    } else if (chamada.ferramenta === "consultar_preco") {
      const { ok: _, ...cotacao } = chamada.saida as Cotacao & { ok: true };
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

function deuCerto(saida: unknown): boolean {
  return (
    typeof saida === "object" &&
    saida !== null &&
    (saida as { ok?: unknown }).ok === true
  );
}
