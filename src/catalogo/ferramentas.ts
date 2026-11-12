import type { z } from "zod";
import {
  type EntradaConsultarPreco,
  type EntradaVerificarDisponibilidade,
  entradaConsultarPreco,
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
  consultarPreco(
    entrada: EntradaConsultarPreco,
  ): Promise<ResultadoDeFerramenta>;
  verificarDisponibilidade(
    entrada: EntradaVerificarDisponibilidade,
  ): Promise<ResultadoDeFerramenta>;
}

export function criarFerramentas(operacoes: Operacoes): Ferramenta[] {
  // The casts are safe: every operation validates its own input.
  return [
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
  ];
}
