// Public interface of the assistente module. Framework-free: nothing from Next or Drizzle.
export {
  type Assistente,
  type ConversaCheia,
  type ConversaDaLista,
  type ConversaNaoExiste,
  criarAssistente,
  eventosDe,
  type LimiteAtingido,
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
  criarLimitadorEmMemoria,
  type Limitador,
  type Limites,
  resolverLimites,
} from "./limitador";
export {
  ASSISTENTE_INDISPONIVEL,
  COMECE_UMA_NOVA_CONVERSA,
  CONVERSA_CHEIA,
  LIMITE_ATINGIDO,
  MUITAS_MENSAGENS,
} from "./mensagens";
export {
  type Embeddings,
  indiceDosEmbeddings,
  resolverEmbeddings,
  resolverModelo,
  resolverModeloDoJuiz,
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
  idsCitados,
  marcadorDeCitacao,
  type PedacoDoTexto,
  type PropostaDoCard,
  propostasDaResposta,
  type TextoDaResposta,
  textoDaMensagem,
  textoDaResposta,
  trechosConsultados,
  trechosDaChamada,
} from "./resposta";
