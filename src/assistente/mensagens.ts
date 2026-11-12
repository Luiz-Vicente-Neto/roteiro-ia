// Texts the Viajante sees, with no dependencies, so the browser can import them too.

/**
 * What the Viajante sees for any provider failure (rate limit, outage, any
 * SDK error). The technical detail stays in the server log.
 */
export const ASSISTENTE_INDISPONIVEL =
  "O Assistente está indisponível agora, tente de novo em instantes.";

/** The erro of a send refused because the Conversa reached its cap; the route and the browser match it too. */
export const CONVERSA_CHEIA = "CONVERSA_CHEIA";

/** What the Viajante sees when a Conversa reaches its cap of messages. */
export const COMECE_UMA_NOVA_CONVERSA =
  "Esta Conversa chegou ao limite de mensagens. Comece uma nova Conversa para continuar.";

/**
 * What the panel shows for a tool call the SDK could not run (an unknown
 * tool, say). The catalog's own refusals come back as results instead.
 */
export const FERRAMENTA_FALHOU = "A ferramenta não pôde ser executada.";
