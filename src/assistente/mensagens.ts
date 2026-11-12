// Texts the Viajante sees, with no dependencies, so the browser can import them too.

/**
 * What the Viajante sees for any provider failure (rate limit, outage, any
 * SDK error). The technical detail stays in the server log.
 */
export const ASSISTENTE_INDISPONIVEL =
  "O Assistente está indisponível agora, tente de novo em instantes.";

/**
 * What the panel shows for a tool call the SDK could not run (an unknown
 * tool, say). The catalog's own refusals come back as results instead.
 */
export const FERRAMENTA_FALHOU = "A ferramenta não pôde ser executada.";
