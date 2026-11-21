// Public interface of the assistente module. Framework-free: nothing from Next or Drizzle.
export {
  type Assistente,
  type ConversaCheia,
  type ConversaDaLista,
  type ConversaNaoExiste,
  criarAssistente,
  eventosDe,
  mensagensDe,
  propostaInexistente,
} from "./assistente";
export {
  type BaseDeConversas,
  type Conversa,
  criarBaseDeConversasEmMemoria,
  type Evento,
  type EventoDaConversa,
  type ItemDaConversa,
} from "./base";
export {
  ASSISTENTE_INDISPONIVEL,
  COMECE_UMA_NOVA_CONVERSA,
  CONVERSA_CHEIA,
} from "./mensagens";
export {
  type Embeddings,
  indiceDosEmbeddings,
  resolverEmbeddings,
  resolverModelo,
} from "./modelo";
export {
  type Chamada,
  type Citacao,
  type CotacaoDoCard,
  cardDetalhado,
  cardsDaResposta,
  chamadasDaResposta,
  chaveDoCard,
  type EstadoDaProposta,
  type PedacoDoTexto,
  type PropostaDoCard,
  propostasDaResposta,
  type TextoDaResposta,
  textoDaMensagem,
  textoDaResposta,
  trechosDaChamada,
} from "./resposta";
