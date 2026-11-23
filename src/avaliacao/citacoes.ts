import type { UIMessage } from "ai";
import { idsCitados, textoDaMensagem, trechosConsultados } from "../assistente";

/** The Trecho ids an answer cited, split by whether the Conversa returned them. */
export interface CitacoesDaResposta {
  /** Returned by a buscar_politicas of the Conversa: the screen shows them. */
  validas: string[];
  /** Never returned in the Conversa: any one fails the whole Avaliação. */
  invalidas: string[];
}

/**
 * Reads every `[[trecho:…]]` of the raw text of `resposta`, without the
 * screen's cleanup that drops the invalid ones. A mark is valid by the
 * screen's own rule: its id came back from a buscar_politicas in `conversa`
 * up to `resposta`, or in `resposta` itself. Each id once, in the order of
 * the text.
 */
export function citacoesDaResposta(
  resposta: UIMessage,
  conversa: UIMessage[],
): CitacoesDaResposta {
  const devolvidos = trechosConsultados(resposta, conversa);
  const citados = [...new Set(idsCitados(textoDaMensagem(resposta)))];
  return {
    validas: citados.filter((id) => devolvidos.has(id)),
    invalidas: citados.filter((id) => !devolvidos.has(id)),
  };
}
