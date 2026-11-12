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
import type { Catalogo, CodigoDeErro, Falha, Relogio } from "../catalogo";
import type {
  BaseDeConversas,
  Conversa,
  Evento,
  EventoDaConversa,
  ItemDaConversa,
} from "./base";
import { historicoParaOModelo, semMarcador } from "./eventos";
import { instrucoes } from "./instrucoes";
import {
  ASSISTENTE_INDISPONIVEL,
  CONVERSA_CHEIA,
  FERRAMENTA_FALHOU,
  PROPOSTA_INEXISTENTE,
} from "./mensagens";
import { type EstadoDaProposta, propostasDaResposta } from "./resposta";

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
  ferramentas: Catalogo["ferramentas"],
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

/** How many words of the Viajante's first message make the Conversa's title. */
const PALAVRAS_DO_TITULO = 6;

/** The first words of `texto`, with "…" when there is more. No model call. */
function tituloDe(texto: string): string {
  const palavras = texto.trim().split(/\s+/);
  const titulo = palavras.slice(0, PALAVRAS_DO_TITULO).join(" ");
  return palavras.length > PALAVRAS_DO_TITULO ? `${titulo}…` : titulo;
}

/**
 * At most this many messages per Conversa, the Viajante's and the
 * Assistente's together, since its whole history goes to the model. Above
 * that, the Viajante starts a new Conversa.
 */
const TETO_DE_MENSAGENS = 40;

/** A Conversa with no activity for longer than this is deleted, lazily. */
const DIAS_ATE_APAGAR_PARADA = 90;
const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;

/** What enviarMensagem answers for a Conversa the dono cannot see. */
export type ConversaNaoExiste = { ok: false; erro: "CONVERSA_NAO_EXISTE" };

/** What enviarMensagem answers once the Conversa has TETO_DE_MENSAGENS. */
export type ConversaCheia = { ok: false; erro: typeof CONVERSA_CHEIA };

/** One Conversa as the sidebar lists it. */
export type ConversaDaLista = Pick<
  Conversa,
  "id" | "titulo" | "ultimaAtividade"
>;

/** The Viajante's and the Assistente's messages of a Conversa's items, without the Eventos. */
export function mensagensDe(itens: ItemDaConversa[]): UIMessage[] {
  return itens.flatMap((item) =>
    item.tipo === "mensagem" ? [item.mensagem] : [],
  );
}

/** The Eventos of a Conversa's items, in order. */
export function eventosDe(itens: ItemDaConversa[]): EventoDaConversa[] {
  return itens.filter((item) => item.tipo === "evento");
}

/** A refusal in the catalog's shape, so the card shows every refusal alike. */
function falhaDoAssistente<C extends CodigoDeErro>(
  erro: C,
  mensagem: string,
): Falha<C> {
  return { ok: false, erro, mensagem };
}

/** For a Proposta the dono did not get in one of their Conversas, it does not exist. */
export function propostaInexistente(): Falha<"PROPOSTA_INEXISTENTE"> {
  return falhaDoAssistente("PROPOSTA_INEXISTENTE", PROPOSTA_INEXISTENTE);
}

export function criarAssistente({
  modelo,
  catalogo,
  conversas,
  relogio,
}: {
  modelo: LanguageModel;
  /**
   * The ferramentas go to the model; confirmarPreReserva never does
   * (docs/adr/0003): only the Viajante's click calls it, via confirmarProposta.
   */
  catalogo: Pick<
    Catalogo,
    "ferramentas" | "confirmarPreReserva" | "situacaoDaProposta"
  >;
  conversas: BaseDeConversas;
  relogio: Relogio;
}) {
  const tools = paraToolsDoSdk(catalogo.ferramentas);

  /** The Conversa `id` if it belongs to `dono`. For anyone else it does not exist. */
  async function conversaDo(dono: string, id: string) {
    const conversa = await conversas.lerConversa(id);
    return conversa?.dono === dono ? conversa : undefined;
  }

  /**
   * The items of the Conversa `conversa` if it is `dono`'s and the model made
   * the Proposta `proposta` in it. Otherwise, for this dono, it does not exist.
   */
  async function itensComAProposta(
    dono: string,
    conversa: string,
    proposta: string,
  ): Promise<ItemDaConversa[] | undefined> {
    if (!(await conversaDo(dono, conversa))) return undefined;
    const itens = await conversas.lerItens(conversa);
    const existe = mensagensDe(itens).some((m) =>
      propostasDaResposta(m).some((p) => p.id === proposta),
    );
    return existe ? itens : undefined;
  }

  async function registrarEvento(conversa: string, evento: Evento) {
    const item: EventoDaConversa = {
      tipo: "evento",
      id: crypto.randomUUID(),
      criadoEm: relogio.agora(),
      evento,
    };
    await conversas.adicionarItem(conversa, item, item.criadoEm);
    return item;
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
      texto: escrito,
    }: {
      dono: string;
      conversa?: string;
      texto: string;
    }): Promise<
      | { ok: true; conversa: string; stream: ReadableStream<UIMessageChunk> }
      | ConversaNaoExiste
      | ConversaCheia
    > {
      // Only confirmarProposta and descartarProposta write Eventos: a Viajante
      // who types the marker gets it removed before anything sees the text.
      const texto = semMarcador(escrito);
      let itens: ItemDaConversa[] = [];
      let id: string;
      if (idDaConversa === undefined) {
        id = crypto.randomUUID();
        const agora = relogio.agora();
        // No scheduled job: each new Conversa clears the idle ones, of every dono.
        await conversas.apagarConversasParadasAntesDe(
          new Date(agora.getTime() - DIAS_ATE_APAGAR_PARADA * UM_DIA_EM_MS),
        );
        await conversas.criarConversa({
          id,
          dono,
          titulo: tituloDe(texto),
          criadaEm: agora,
          ultimaAtividade: agora,
        });
      } else {
        if (!(await conversaDo(dono, idDaConversa))) {
          return { ok: false, erro: "CONVERSA_NAO_EXISTE" };
        }
        id = idDaConversa;
        itens = await conversas.lerItens(id);
        // Refused before anything is recorded or the model is called. Eventos
        // do not count: only the messages.
        if (mensagensDe(itens).length >= TETO_DE_MENSAGENS) {
          return { ok: false, erro: CONVERSA_CHEIA };
        }
      }

      const doViajante: ItemDaConversa = {
        tipo: "mensagem",
        mensagem: {
          id: crypto.randomUUID(),
          role: "user",
          parts: [{ type: "text", text: texto }],
        },
      };
      await conversas.adicionarItem(id, doViajante, relogio.agora());
      const mensagens = historicoParaOModelo([...itens, doViajante]);

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

    /**
     * The Viajante confirms the Proposta `proposta` of the Conversa
     * `conversa`: the catalog makes the Pré-reserva, checking everything
     * again, and an Evento records it for the model's next answer. The
     * catalog's refusal comes back as is, and records nothing.
     */
    async confirmarProposta({
      dono,
      conversa,
      proposta,
    }: {
      dono: string;
      conversa: string;
      proposta: string;
    }) {
      if (!(await itensComAProposta(dono, conversa, proposta))) {
        return propostaInexistente();
      }
      const confirmacao = await catalogo.confirmarPreReserva(proposta);
      if (!confirmacao.ok) return confirmacao;
      const evento = await registrarEvento(conversa, {
        tipo: "proposta-confirmada",
        idDaProposta: proposta,
        codigo: confirmacao.preReserva.codigo,
      });
      return { ...confirmacao, evento };
    },

    /**
     * The Viajante discards the Proposta `proposta` of the Conversa
     * `conversa`. Nothing changes in the catalog: an Evento just tells the
     * model, in its next answer, that the Viajante let it go. A confirmed
     * Proposta cannot be discarded: its Evento would tell the model the Vagas
     * are free. Discarding again only answers the Evento already recorded.
     */
    async descartarProposta({
      dono,
      conversa,
      proposta,
    }: {
      dono: string;
      conversa: string;
      proposta: string;
    }) {
      const itens = await itensComAProposta(dono, conversa, proposta);
      if (!itens) return propostaInexistente();
      const situacao = await catalogo.situacaoDaProposta(proposta);
      if (situacao.ok && situacao.situacao === "confirmada") {
        return falhaDoAssistente(
          "PROPOSTA_JA_CONFIRMADA",
          "Esta Proposta já foi confirmada, e a Pré-reserva continua valendo.",
        );
      }
      const anterior = eventosDe(itens).find(
        (e) =>
          e.evento.tipo === "proposta-descartada" &&
          e.evento.idDaProposta === proposta,
      );
      if (anterior) return { ok: true as const, evento: anterior };
      const evento = await registrarEvento(conversa, {
        tipo: "proposta-descartada",
        idDaProposta: proposta,
      });
      return { ok: true as const, evento };
    },

    /**
     * The current state of each Proposta of the Conversa, by id, for its
     * cards; undefined when the Conversa is not `dono`'s. A confirmation
     * wins over a discard, and a discard over the expiry.
     */
    async estadosDasPropostas({
      dono,
      conversa,
    }: {
      dono: string;
      conversa: string;
    }): Promise<Record<string, EstadoDaProposta> | undefined> {
      if (!(await conversaDo(dono, conversa))) return undefined;
      const itens = await conversas.lerItens(conversa);
      const descartadas = new Set(
        itens.flatMap((i) =>
          i.tipo === "evento" && i.evento.tipo === "proposta-descartada"
            ? [i.evento.idDaProposta]
            : [],
        ),
      );
      const ids = mensagensDe(itens).flatMap((m) =>
        propostasDaResposta(m).map((p) => p.id),
      );
      const estados = await Promise.all(
        ids.map(async (id): Promise<[string, EstadoDaProposta]> => {
          const situacao = await catalogo.situacaoDaProposta(id);
          // Gone from the catalog (a new catalog was loaded): nothing to confirm.
          if (!situacao.ok) return [id, { estado: "expirada" }];
          if (situacao.situacao === "confirmada") {
            const { codigo, expiraEm } = situacao.preReserva;
            return [
              id,
              { estado: "confirmada", codigo, bloqueadaAte: expiraEm },
            ];
          }
          if (descartadas.has(id)) return [id, { estado: "descartada" }];
          return [
            id,
            situacao.situacao === "valida"
              ? { estado: "valida", expiraEm: situacao.expiraEm }
              : { estado: "expirada" },
          ];
        }),
      );
      return Object.fromEntries(estados);
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

    /** Deletes the Conversa and its items. For anyone but its dono, it does not exist, so nothing happens. */
    async apagarConversa({
      dono,
      conversa,
    }: {
      dono: string;
      conversa: string;
    }): Promise<void> {
      if (!(await conversaDo(dono, conversa))) return;
      await conversas.apagarConversa(conversa);
    },

    /** The Conversas of `dono` for the sidebar, the most recent first. */
    async listarConversas({
      dono,
    }: {
      dono: string;
    }): Promise<ConversaDaLista[]> {
      const lista = await conversas.listarConversas(dono);
      return lista.map(({ id, titulo, ultimaAtividade }) => ({
        id,
        titulo,
        ultimaAtividade,
      }));
    },
  };
}

export type Assistente = ReturnType<typeof criarAssistente>;
