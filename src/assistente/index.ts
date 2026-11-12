// Public interface of the assistente module. Framework-free: nothing from Next or Drizzle.
export {
  type Assistente,
  type ConversaNaoExiste,
  criarAssistente,
  mensagensDe,
} from "./assistente";
export {
  type BaseDeConversas,
  type Conversa,
  criarBaseDeConversasEmMemoria,
  type Evento,
  type ItemDaConversa,
} from "./base";
export { ASSISTENTE_INDISPONIVEL } from "./mensagens";
export { resolverModelo } from "./modelo";
export {
  type Chamada,
  type CotacaoDoCard,
  cardDetalhado,
  cardsDaResposta,
  chamadasDaResposta,
  chaveDoCard,
} from "./resposta";
