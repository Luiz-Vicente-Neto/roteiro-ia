import {
  convertToModelMessages,
  createUIMessageStream,
  isStepCount,
  jsonSchema,
  type LanguageModel,
  streamText,
  type Tool,
  toUIMessageStream,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { z } from "zod";
import type { Ferramenta, Relogio } from "../catalogo";
import { instrucoes } from "./instrucoes";
import { ASSISTENTE_INDISPONIVEL } from "./mensagens";

/**
 * At most this many tool steps per answer, so a confused model cannot burn
 * the free quota. The step after the last one must answer in text.
 */
const PASSOS_DE_FERRAMENTA = 6;

/**
 * Adapts the catalog's ferramentas to the SDK's tool format. The JSON Schema
 * is sent to the model, but the SDK does not validate the input: `executar`
 * does, so invalid input reaches the model as ENTRADA_INVALIDA, like in every
 * other client of the ferramentas.
 */
function paraToolsDoSdk(
  ferramentas: readonly Ferramenta[],
): Record<string, Tool> {
  return Object.fromEntries(
    ferramentas.map((f) => [
      f.nome,
      {
        description: f.descricao,
        inputSchema: jsonSchema(
          z.toJSONSchema(f.schemaDeEntrada, { io: "input" }),
        ),
        execute: (entrada: unknown) => f.executar(entrada),
      } satisfies Tool,
    ]),
  );
}

export function criarAssistente({
  modelo,
  catalogo,
  relogio,
}: {
  modelo: LanguageModel;
  /** Only the ferramentas: confirmarPreReserva never reaches the model (docs/adr/0003). */
  catalogo: { ferramentas: readonly Ferramenta[] };
  relogio: Relogio;
}) {
  const tools = paraToolsDoSdk(catalogo.ferramentas);

  return {
    enviarMensagem({
      historico,
      texto,
    }: {
      historico: UIMessage[];
      texto: string;
    }): ReadableStream<UIMessageChunk> {
      const mensagens: UIMessage[] = [
        ...historico,
        {
          id: crypto.randomUUID(),
          role: "user",
          parts: [{ type: "text", text: texto }],
        },
      ];
      return createUIMessageStream({
        execute: async ({ writer }) => {
          const resultado = streamText({
            model: modelo,
            instructions: instrucoes(relogio.hoje()),
            tools,
            stopWhen: isStepCount(PASSOS_DE_FERRAMENTA + 1),
            prepareStep: ({ stepNumber }) =>
              stepNumber >= PASSOS_DE_FERRAMENTA
                ? { toolChoice: "none", activeTools: [] }
                : undefined,
            messages: await convertToModelMessages(mensagens, { tools }),
          });
          writer.merge(
            toUIMessageStream({
              stream: resultado.stream,
              tools,
              onError: () => ASSISTENTE_INDISPONIVEL,
            }),
          );
        },
        // streamText already logged the technical detail on the server.
        onError: () => ASSISTENTE_INDISPONIVEL,
      });
    },
  };
}

export type Assistente = ReturnType<typeof criarAssistente>;
