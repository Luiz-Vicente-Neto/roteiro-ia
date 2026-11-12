import type { z } from "zod";
import {
  type EntradaVerificarDisponibilidade,
  entradaVerificarDisponibilidade,
} from "./entradas";
import type { Falha } from "./erros";

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
  verificarDisponibilidade(
    entrada: EntradaVerificarDisponibilidade,
  ): Promise<ResultadoDeFerramenta>;
}

export function criarFerramentas(operacoes: Operacoes): Ferramenta[] {
  // The casts are safe: every operation validates its own input.
  return [
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
