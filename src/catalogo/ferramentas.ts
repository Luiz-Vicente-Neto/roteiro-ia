import type { z } from "zod";
import {
  type EntradaBuscarPacotes,
  type EntradaConsultarPreco,
  type EntradaProporPreReserva,
  type EntradaVerificarDisponibilidade,
  entradaBuscarPacotes,
  entradaConsultarPreco,
  entradaProporPreReserva,
  entradaVerificarDisponibilidade,
} from "./entradas";
import type { Falha } from "./erros";
import { IDADE_ADULTA } from "./grupo";

export type ResultadoDeFerramenta = { readonly ok: true } | Falha;

/**
 * One tool the model can call. This list is the single definition that the
 * chat (stage 2) and the MCP server (stage 5) adapt to their own formats.
 */
export interface Ferramenta {
  /** Name the model sees, in Portuguese snake_case. */
  nome: string;
  /** Written for the model: when to call it and what comes back. */
  descricao: string;
  schemaDeEntrada: z.ZodType;
  /** Takes the model's raw input: invalid input comes back as ENTRADA_INVALIDA, never as an exception. */
  executar(entrada: unknown): Promise<ResultadoDeFerramenta>;
}

interface Operacoes {
  buscarPacotes(entrada: EntradaBuscarPacotes): Promise<ResultadoDeFerramenta>;
  consultarPreco(
    entrada: EntradaConsultarPreco,
  ): Promise<ResultadoDeFerramenta>;
  verificarDisponibilidade(
    entrada: EntradaVerificarDisponibilidade,
  ): Promise<ResultadoDeFerramenta>;
  proporPreReserva(
    entrada: EntradaProporPreReserva,
  ): Promise<ResultadoDeFerramenta>;
}

export function criarFerramentas(operacoes: Operacoes): Ferramenta[] {
  // The casts are safe: every operation validates its own input.
  return [
    {
      nome: "buscar_pacotes",
      descricao:
        'Busca Pacotes do catálogo para um Grupo e devolve opções concretas e compráveis, cada uma uma Cotação. Use para pedidos como "4 dias em Gramado em julho, casal, até R$ 4 mil" ou buscas abertas ("algo até R$ 3 mil em março"). ' +
        `O grupo é obrigatório (adultos e idades das crianças; de ${IDADE_ADULTA} anos em diante, a pessoa conta como adulto). O destino (sem diferenciar maiúsculas nem acentos), a janela de datas em que a Saída começa e o orçamento são opcionais. ` +
        "O orçamento é o valor TOTAL do Grupo, não por pessoa, em centavos (R$ 4.000 = 400000). Sem destino, busca em todos; sem janela, de hoje até a última Saída. " +
        "Ficam só as Saídas futuras, com Vagas para o Grupo inteiro, dentro do orçamento e em Pacotes cuja Política de Crianças aceita o Grupo. " +
        "Devolve no máximo uma Cotação por Pacote (a da Saída mais barata na janela), com as outras datas que também servem em outrasSaidas, do total mais barato para o mais caro, até 10 resultados. " +
        "Se nada servir, devolve cotacoes vazia e um diagnostico: quantas Saídas futuras havia na janela e quantas caíram pela Política de Crianças, por falta de Vagas e por orçamento (cada Saída conta só no primeiro desses motivos, nessa ordem), com o menorPreco entre as que caíram só por orçamento; use-o para explicar ao viajante e sugerir um ajuste. " +
        "Se o destino não existir, devolve DESTINO_DESCONHECIDO com os Destinos existentes em sugestoes.",
      schemaDeEntrada: entradaBuscarPacotes,
      executar: (entrada) =>
        operacoes.buscarPacotes(entrada as EntradaBuscarPacotes),
    },
    {
      nome: "consultar_preco",
      descricao:
        "Calcula o preço de um Pacote numa data de Saída para um Grupo e devolve uma Cotação. Use para responder quanto custa uma viagem numa data específica, ou para comparar datas. " +
        `Recebe o slug do Pacote, a data da Saída (AAAA-MM-DD) e o Grupo (adultos e idades das crianças; de ${IDADE_ADULTA} anos em diante, a pessoa paga como adulto). ` +
        "A Cotação traz o preço de cada pessoa (cada criança com a faixa de idade e o percentual do preço de adulto da Política de Crianças) e o total do Grupo em centavos, o Período Tarifário aplicado e seu fator (ou baixa temporada), os Períodos que também cobriam a data e perderam, quantas Vagas o Grupo ocupa e as Vagas restantes. " +
        "Se a data não for uma Saída do Pacote ou já tiver passado, devolve um erro com as Saídas mais próximas em sugestoes. Se o Pacote não aceitar crianças e o Grupo tiver alguma, devolve GRUPO_NAO_ACEITO com o motivo.",
      schemaDeEntrada: entradaConsultarPreco,
      executar: (entrada) =>
        operacoes.consultarPreco(entrada as EntradaConsultarPreco),
    },
    {
      nome: "verificar_disponibilidade",
      descricao:
        "Informa quantas Vagas restam numa Saída de um Pacote. Use para responder se ainda há Vagas numa data. " +
        "Recebe o slug do Pacote e a data da Saída (AAAA-MM-DD) e devolve as Vagas totais e as Vagas restantes. " +
        "Se a data não for uma Saída do Pacote ou já tiver passado, devolve um erro com as Saídas mais próximas em sugestoes.",
      schemaDeEntrada: entradaVerificarDisponibilidade,
      executar: (entrada) =>
        operacoes.verificarDisponibilidade(
          entrada as EntradaVerificarDisponibilidade,
        ),
    },
    {
      nome: "propor_pre_reserva",
      descricao:
        "Prepara uma Proposta de Pré-reserva de um Pacote numa data de Saída para um Grupo, para o viajante confirmar. Esta ferramenta NÃO reserva e não bloqueia Vagas: só o viajante confirma a Proposta, por um pedido de confirmação fora desta conversa, e você não tem como confirmar por ele. " +
        "Use quando o viajante escolheu Pacote, data e Grupo e quer reservar. Recebe o mesmo que consultar_preco (slug do Pacote, data da Saída AAAA-MM-DD e Grupo) e valida o mesmo, com os mesmos erros. " +
        "Devolve o id da Proposta, a Cotação e expiraEm, o instante em que a Proposta deixa de valer: ela vale 15 minutos. Mostre ao viajante o resumo e o total e diga que ele precisa confirmar para garantir as Vagas; nunca diga que a viagem está reservada. " +
        "Se a Saída não tiver Vagas restantes para o Grupo inteiro (cada criança ocupa uma Vaga), devolve VAGAS_INSUFICIENTES com as Saídas mais próximas que cabem o Grupo em sugestoes.",
      schemaDeEntrada: entradaProporPreReserva,
      executar: (entrada) =>
        operacoes.proporPreReserva(entrada as EntradaProporPreReserva),
    },
  ];
}
