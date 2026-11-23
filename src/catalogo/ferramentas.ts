import type { z } from "zod";
import {
  type EntradaBuscarPacotes,
  type EntradaBuscarPoliticas,
  type EntradaConsultarPreco,
  type EntradaProporPreReserva,
  type EntradaVerificarDisponibilidade,
  entradaBuscarPacotes,
  entradaBuscarPoliticas,
  entradaConsultarPreco,
  entradaProporPreReserva,
  entradaVerificarDisponibilidade,
} from "./entradas";
import type { Falha } from "./erros";
import { IDADE_ADULTA } from "./grupo";

/** What every Ferramenta gives back: its own success result, or a Falha. */
type Resultado = { readonly ok: true } | Falha;

/**
 * One tool the model can call. This list is the single definition that the
 * chat (stage 2) and the MCP server (stage 5) adapt to their own formats.
 * `R` is the exact result of the operation behind it, so whoever reads a
 * finished call reads it typed (see NomeDeFerramenta and ResultadoDe).
 */
export interface Ferramenta<N extends string = string, R = Resultado> {
  /** Name the model sees, in Portuguese snake_case. */
  nome: N;
  /** Written for the model: when to call it and what comes back. */
  descricao: string;
  schemaDeEntrada: z.ZodType;
  /** Takes the model's raw input: invalid input comes back as ENTRADA_INVALIDA, never as an exception. */
  executar(entrada: unknown): Promise<R>;
}

type Operacao<E> = (entrada: E) => Promise<Resultado>;

/** A Ferramenta that runs `executar` and keeps its exact result type. */
function definirFerramenta<
  const N extends string,
  F extends (entrada: never) => Promise<Resultado>,
>(ferramenta: {
  nome: N;
  descricao: string;
  schemaDeEntrada: z.ZodType;
  executar: F;
}): Ferramenta<N, Awaited<ReturnType<F>>> {
  const { executar } = ferramenta;
  return {
    ...ferramenta,
    // The cast is safe: every operation validates its own input.
    executar: (entrada) =>
      executar(entrada as never) as Promise<Awaited<ReturnType<F>>>,
  };
}

/**
 * The catalog operations behind the Ferramentas, by the input each takes. One
 * type parameter per operation, not one for the whole object: TypeScript keeps
 * `ReturnType` of a type parameter open until the call, but resolves it on
 * `O["buscarPacotes"]` to the bare constraint, and the exact result is lost.
 */
export function criarFerramentas<
  BuscarPacotes extends Operacao<EntradaBuscarPacotes>,
  BuscarPoliticas extends Operacao<EntradaBuscarPoliticas>,
  ConsultarPreco extends Operacao<EntradaConsultarPreco>,
  VerificarDisponibilidade extends Operacao<EntradaVerificarDisponibilidade>,
  ProporPreReserva extends Operacao<EntradaProporPreReserva>,
>(operacoes: {
  buscarPacotes: BuscarPacotes;
  buscarPoliticas: BuscarPoliticas;
  consultarPreco: ConsultarPreco;
  verificarDisponibilidade: VerificarDisponibilidade;
  proporPreReserva: ProporPreReserva;
}) {
  return [
    definirFerramenta({
      nome: "buscar_pacotes",
      descricao:
        'Busca Pacotes do catálogo para um Grupo e devolve opções concretas e compráveis, cada uma uma Cotação. Use para pedidos como "4 dias em Gramado em julho, casal, até R$ 6 mil" ou buscas abertas ("algo até R$ 3 mil em março"). ' +
        `O grupo é obrigatório (adultos e idades das crianças; de ${IDADE_ADULTA} anos em diante, a pessoa conta como adulto). O destino (sem diferenciar maiúsculas nem acentos), a janela de datas em que a Saída começa e o orçamento são opcionais. ` +
        "O orçamento é o valor TOTAL do Grupo, não por pessoa, em centavos (R$ 4.000 = 400000). Sem destino, busca em todos; sem janela, de hoje até a última Saída. " +
        "Ficam só as Saídas futuras, com Vagas para o Grupo inteiro, dentro do orçamento e em Pacotes cuja Política de Crianças aceita o Grupo. " +
        "Devolve no máximo uma Cotação por Pacote (a da Saída mais barata na janela), com as outras datas que também servem em outrasSaidas, do total mais barato para o mais caro, até 10 resultados. " +
        "Se nada servir, devolve cotacoes vazia e um diagnostico: quantas Saídas futuras havia na janela e quantas caíram pela Política de Crianças, por falta de Vagas e por orçamento (cada Saída conta só no primeiro desses motivos, nessa ordem), com o menorPreco entre as que caíram só por orçamento; use-o para explicar ao viajante e sugerir um ajuste. " +
        "Se o destino não existir, devolve DESTINO_DESCONHECIDO com os Destinos existentes em sugestoes.",
      schemaDeEntrada: entradaBuscarPacotes,
      executar: operacoes.buscarPacotes,
    }),
    definirFerramenta({
      nome: "buscar_politicas",
      descricao:
        "Busca nos textos do catálogo os Trechos que respondem a uma pergunta sobre regras e políticas da agência (cancelamento e reembolso, pagamento, documentos de viagem, o que a Pré-reserva garante, crianças e pets), sobre um Destino (clima, quando ir, o que fazer) ou sobre um Hotel (estrutura, check-in, estacionamento, regras de pets e exceções às regras da agência). " +
        "Recebe a pergunta do viajante e, opcionalmente, o destino (nome ou slug) ou o pacote (slug). Sem nenhum dos dois, busca só na Política da Agência e nas perguntas frequentes gerais, que valem para todos. Com destino, busca também nos textos do Destino (descrição e perguntas frequentes) e de todos os Hotéis dele. Com pacote, busca também nos textos do Destino e só do Hotel desse Pacote: quando o viajante fala de um Pacote, passe o slug dele, para receber a regra do Hotel certo. " +
        "Devolve os 5 Trechos mais próximos da pergunta, cada um com id, tituloDoDocumento, secao e textoCitado. Nem todos respondem à pergunta: use só os que respondem e, se nenhum responder, diga que não sabe. Quando um Trecho de Hotel diz que a regra dele é diferente da Política da Agência, vale a do Hotel. " +
        "Nunca traz preço, Vagas nem datas de Saída: esses valores vêm só das outras ferramentas. " +
        "Se o destino não existir, devolve DESTINO_DESCONHECIDO com os Destinos existentes em sugestoes; se o pacote não existir, PACOTE_DESCONHECIDO com os slugs parecidos em sugestoes. " +
        "Se a busca estiver fora do ar, devolve BUSCA_INDISPONIVEL: repasse a mensagem ao viajante como está, sem responder com o que você sabe de fora.",
      schemaDeEntrada: entradaBuscarPoliticas,
      executar: operacoes.buscarPoliticas,
    }),
    definirFerramenta({
      nome: "consultar_preco",
      descricao:
        "Calcula o preço de um Pacote numa data de Saída para um Grupo e devolve uma Cotação. Use para responder quanto custa uma viagem numa data específica, ou para comparar datas. " +
        `Recebe o slug do Pacote, a data da Saída (AAAA-MM-DD) e o Grupo (adultos e idades das crianças; de ${IDADE_ADULTA} anos em diante, a pessoa paga como adulto). ` +
        "A Cotação traz o preço de cada pessoa (cada criança com a faixa de idade e o percentual do preço de adulto da Política de Crianças) e o total do Grupo em centavos, o Período Tarifário aplicado e seu fator (ou baixa temporada), os Períodos que também cobriam a data e perderam, quantas Vagas o Grupo ocupa e as Vagas restantes. " +
        "Se a data não for uma Saída do Pacote ou já tiver passado, devolve um erro com as Saídas mais próximas em sugestoes. Se o Pacote não aceitar crianças e o Grupo tiver alguma, devolve GRUPO_NAO_ACEITO com o motivo.",
      schemaDeEntrada: entradaConsultarPreco,
      executar: operacoes.consultarPreco,
    }),
    definirFerramenta({
      nome: "verificar_disponibilidade",
      descricao:
        "Informa quantas Vagas restam numa Saída de um Pacote. Use para responder se ainda há Vagas numa data. " +
        "Recebe o slug do Pacote e a data da Saída (AAAA-MM-DD) e devolve as Vagas totais e as Vagas restantes. " +
        "Se a data não for uma Saída do Pacote ou já tiver passado, devolve um erro com as Saídas mais próximas em sugestoes.",
      schemaDeEntrada: entradaVerificarDisponibilidade,
      executar: operacoes.verificarDisponibilidade,
    }),
    definirFerramenta({
      nome: "propor_pre_reserva",
      descricao:
        "Prepara uma Proposta de Pré-reserva de um Pacote numa data de Saída para um Grupo, para o viajante confirmar. Esta ferramenta NÃO reserva e não bloqueia Vagas: só o viajante confirma a Proposta, por um pedido de confirmação fora desta conversa, e você não tem como confirmar por ele. " +
        "Use quando o viajante escolheu Pacote, data e Grupo e quer reservar. Recebe o mesmo que consultar_preco (slug do Pacote, data da Saída AAAA-MM-DD e Grupo) e valida o mesmo, com os mesmos erros. " +
        "Devolve o id da Proposta, a Cotação e expiraEm, o instante em que a Proposta deixa de valer: ela vale 15 minutos. Mostre ao viajante o resumo e o total e diga que ele precisa confirmar para garantir as Vagas; nunca diga que a viagem está reservada. " +
        "Se a Saída não tiver Vagas restantes para o Grupo inteiro (cada criança ocupa uma Vaga), devolve VAGAS_INSUFICIENTES com as Saídas mais próximas que cabem o Grupo em sugestoes.",
      schemaDeEntrada: entradaProporPreReserva,
      executar: operacoes.proporPreReserva,
    }),
  ];
}
