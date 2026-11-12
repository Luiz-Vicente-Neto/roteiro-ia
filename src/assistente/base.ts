import type { UIMessage } from "ai";

/** A Conversa's own fields. Its items are read apart, with `lerItens`. */
export interface Conversa {
  id: string;
  /** The anonymous id of the browser that owns it. */
  dono: string;
  /** Empty until the sidebar's ticket fills it. */
  titulo: string;
  criadaEm: Date;
  ultimaAtividade: Date;
}

/**
 * Something only the system writes in a Conversa, never the Viajante nor the
 * Assistente. Plain JSON values only, so every Base stores it as is. Only the
 * Proposta's ticket creates them.
 */
export type Evento =
  | { tipo: "proposta-confirmada"; idDaProposta: string; codigo: string }
  | { tipo: "proposta-descartada"; idDaProposta: string };

/**
 * One item of a Conversa, in order: a message of the Viajante or of the
 * Assistente (with its tool calls and their results in the parts), or an Evento.
 */
export type ItemDaConversa =
  | { tipo: "mensagem"; mensagem: UIMessage }
  | { tipo: "evento"; id: string; criadoEm: Date; evento: Evento };

/**
 * Base de Conversas: everything the assistente module needs from storage,
 * and nothing more, in the same design as the Base do Catálogo
 * (docs/adr/0001). Who may open a Conversa is the module's rule, not storage's.
 */
export interface BaseDeConversas {
  /** Records a new Conversa under its id, which the caller guarantees is new. */
  criarConversa(conversa: Conversa): Promise<void>;
  /** The Conversa with `id`, or undefined if none was recorded. */
  lerConversa(id: string): Promise<Conversa | undefined>;
  /** The items of the Conversa `id`, in the order they were added. */
  lerItens(id: string): Promise<ItemDaConversa[]>;
  /** Appends `item` to the Conversa `id` (which must exist) and sets its última atividade to `agora`. */
  adicionarItem(id: string, item: ItemDaConversa, agora: Date): Promise<void>;
}

export function criarBaseDeConversasEmMemoria(): BaseDeConversas {
  // Copied on the way in and out, so no caller can change what is stored.
  const conversas = new Map<
    string,
    { conversa: Conversa; itens: ItemDaConversa[] }
  >();
  const existente = (id: string) => {
    const guardada = conversas.get(id);
    if (!guardada) throw new Error(`Conversa ${id} não existe`);
    return guardada;
  };
  return {
    async criarConversa(conversa) {
      conversas.set(conversa.id, {
        conversa: structuredClone(conversa),
        itens: [],
      });
    },
    async lerConversa(id) {
      const guardada = conversas.get(id);
      return guardada && structuredClone(guardada.conversa);
    },
    async lerItens(id) {
      return structuredClone(conversas.get(id)?.itens ?? []);
    },
    async adicionarItem(id, item, agora) {
      const { conversa, itens } = existente(id);
      itens.push(structuredClone(item));
      conversa.ultimaAtividade = new Date(agora);
    },
  };
}
