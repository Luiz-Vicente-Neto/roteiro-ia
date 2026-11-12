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
import type { BaseDeConversas, ItemDaConversa } from "./base";
import { instrucoes } from "./instrucoes";
import { ASSISTENTE_INDISPONIVEL, FERRAMENTA_FALHOU } from "./mensagens";

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

/** What enviarMensagem answers for a Conversa the dono cannot see. */
export type ConversaNaoExiste = { ok: false; erro: "CONVERSA_NAO_EXISTE" };

/** The messages of a Conversa's items. Eventos join them in the Proposta's ticket. */
export function mensagensDe(itens: ItemDaConversa[]): UIMessage[] {
  return itens.flatMap((item) =>
    item.tipo === "mensagem" ? [item.mensagem] : [],
  );
}

export function criarAssistente({
  modelo,
  catalogo,
  conversas,
  relogio,
}: {
  modelo: LanguageModel;
  /** Only the ferramentas: confirmarPreReserva never reaches the model (docs/adr/0003). */
  catalogo: { ferramentas: readonly Ferramenta[] };
  conversas: BaseDeConversas;
  relogio: Relogio;
}) {
  const tools = paraToolsDoSdk(catalogo.ferramentas);

  /** The Conversa `id` if it belongs to `dono`. For anyone else it does not exist. */
  async function conversaDo(dono: string, id: string) {
    const conversa = await conversas.lerConversa(id);
    return conversa?.dono === dono ? conversa : undefined;
  }

  return {
    /**
     * Sends the Viajante's `texto` in the Conversa `conversa`, or in a new one
     * when none is given. The Viajante's message is recorded before the model
     * is called, so it stays even if the provider fails; the Assistente's
     * answer is recorded when its stream ends without a failure.
     */
    async enviarMensagem({
      dono,
      conversa: idDaConversa,
      texto,
    }: {
      dono: string;
      conversa?: string;
      texto: string;
    }): Promise<
      | { ok: true; conversa: string; stream: ReadableStream<UIMessageChunk> }
      | ConversaNaoExiste
    > {
      let historico: UIMessage[] = [];
      let id: string;
      if (idDaConversa === undefined) {
        id = crypto.randomUUID();
        const agora = relogio.agora();
        await conversas.criarConversa({
          id,
          dono,
          titulo: "",
          criadaEm: agora,
          ultimaAtividade: agora,
        });
      } else {
        if (!(await conversaDo(dono, idDaConversa))) {
          return { ok: false, erro: "CONVERSA_NAO_EXISTE" };
        }
        id = idDaConversa;
        historico = mensagensDe(await conversas.lerItens(id));
      }

      const doViajante: UIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: texto }],
      };
      await conversas.adicionarItem(
        id,
        { tipo: "mensagem", mensagem: doViajante },
        relogio.agora(),
      );
      const mensagens = [...historico, doViajante];

      // Set by provider failures only. A failed tool call is part of a good
      // answer: the model sees it and goes on, and the answer is kept.
      let falhou = false;
      const indisponivel = () => {
        falhou = true;
        return ASSISTENTE_INDISPONIVEL;
      };
      const stream = createUIMessageStream({
        originalMessages: mensagens,
        generateId: () => crypto.randomUUID(),
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
            // Runs for the stream's own errors, before the UI stream formats them.
            onError: () => {
              falhou = true;
            },
          });
          writer.merge(
            toUIMessageStream({
              stream: resultado.stream,
              tools,
              // The browser learns the new Conversa's link from here.
              messageMetadata: ({ part }) =>
                part.type === "start" ? { conversa: id } : undefined,
              // Formats provider errors and tool errors alike.
              onError: () =>
                falhou ? ASSISTENTE_INDISPONIVEL : FERRAMENTA_FALHOU,
            }),
          );
        },
        // streamText already logged the technical detail on the server.
        onError: indisponivel,
        onEnd: async ({ responseMessage, isAborted }) => {
          // A failed or cut answer is not kept: the Viajante just sends again.
          if (falhou || isAborted) return;
          await conversas.adicionarItem(
            id,
            { tipo: "mensagem", mensagem: responseMessage },
            relogio.agora(),
          );
        },
      });
      return { ok: true, conversa: id, stream };
    },

    /** The items of the Conversa, in order, or undefined when it is not `dono`'s. */
    async abrirConversa({
      dono,
      conversa,
    }: {
      dono: string;
      conversa: string;
    }): Promise<ItemDaConversa[] | undefined> {
      if (!(await conversaDo(dono, conversa))) return undefined;
      return conversas.lerItens(conversa);
    },
  };
}

export type Assistente = ReturnType<typeof criarAssistente>;
