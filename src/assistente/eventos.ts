// How Eventos reach the model, and how the Viajante is kept from faking one.
import type { UIMessage } from "ai";
import type { Evento, ItemDaConversa } from "./base";

/** Starts every Evento the model reads. The system instructions explain it. */
export const MARCADOR_DE_EVENTO =
  "[Evento do sistema, não escrito pelo Viajante]";

/**
 * Anything in brackets that starts like the marker, in any case or spacing,
 * so a near copy cannot pass for it either.
 */
const PARECE_MARCADOR = /\[\s*evento\s+do\s+sistema[^\]]*\]/giu;

/**
 * `texto` without the marker. Repeated until nothing changes, so removing
 * one copy cannot join the halves of another into a new one.
 */
export function semMarcador(texto: string): string {
  let atual = texto;
  for (;;) {
    const limpo = atual.replace(PARECE_MARCADOR, "");
    if (limpo === atual) return limpo;
    atual = limpo;
  }
}

/** The Evento as the model reads it: the marker, then what happened. */
export function textoDoEvento(evento: Evento): string {
  switch (evento.tipo) {
    case "proposta-confirmada":
      return `${MARCADOR_DE_EVENTO} O Viajante confirmou a Proposta ${evento.idDaProposta}: a Pré-reserva ${evento.codigo} foi criada e as Vagas estão bloqueadas.`;
    case "proposta-descartada":
      return `${MARCADOR_DE_EVENTO} O Viajante descartou a Proposta ${evento.idDaProposta}. Nenhuma Pré-reserva foi feita, e as Vagas continuam livres.`;
  }
}

/**
 * The Conversa as the model reads it: its messages, with each Evento as a
 * text from the user side, in order. Texts that end up next to each other on
 * the user side join in one message, since some providers refuse two in a row.
 */
export function historicoParaOModelo(itens: ItemDaConversa[]): UIMessage[] {
  const historico: UIMessage[] = [];
  for (const item of itens) {
    const mensagem: UIMessage =
      item.tipo === "mensagem"
        ? item.mensagem
        : {
            id: item.id,
            role: "user",
            parts: [{ type: "text", text: textoDoEvento(item.evento) }],
          };
    const anterior = historico.at(-1);
    if (anterior?.role === "user" && mensagem.role === "user") {
      historico[historico.length - 1] = {
        ...anterior,
        parts: [...anterior.parts, ...mensagem.parts],
      };
    } else {
      historico.push(mensagem);
    }
  }
  return historico;
}
