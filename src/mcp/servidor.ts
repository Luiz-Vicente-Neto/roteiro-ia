import {
  acceptedContent,
  type CallToolResult,
  CLIENT_CAPABILITIES_META_KEY,
  type ClientCapabilities,
  createRequestStateCodec,
  inputRequired,
  McpServer,
  type RequestStateCodec,
  type ServerContext,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Catalogo, Falha } from "../catalogo";

export interface OpcoesDoServidorMcp {
  /**
   * HMAC key (at least 32 bytes) that signs the state of the confirmation
   * request. Defaults to one drawn at random when the process starts: the
   * process serves every round of a call, and nothing has to be configured.
   */
  chaveDoEstado?: Uint8Array;
}

/** The state of the confirmation request carries only the Proposta's id. */
interface EstadoDaPergunta {
  proposta: string;
}

const CHAVE_DO_PROCESSO = crypto.getRandomValues(new Uint8Array(32));

/** The signed state lives as long as the Proposta: 15 minutes. */
const VALIDADE_DO_ESTADO_S = 15 * 60;

/**
 * The MCP's own description of propor_pre_reserva. The shared one says the
 * Proposta goes back for a button, which is not what happens here; it stays
 * as is, so the Avaliação's Impressão digital does not change.
 */
const DESCRICAO_DA_PROPOSTA =
  "Prepara uma Pré-reserva de um Pacote numa data de Saída para um Grupo e pergunta ao viajante, numa pergunta de confirmação que o servidor faz pelo próprio cliente, se ele confirma o Pacote, a data, o Grupo e o total. Só a resposta dele confirma: você não tem como confirmar por ele. " +
  "Use quando o viajante escolheu Pacote, data e Grupo e quer reservar. Recebe o mesmo que consultar_preco (slug do Pacote, data da Saída AAAA-MM-DD e Grupo) e valida o mesmo, com os mesmos erros. " +
  "A chamada só termina depois da resposta. Se ele confirmar, devolve a Pré-reserva: o código (RT-XXXX), o total, expiraEm (até quando ela segura as Vagas: 24 horas) e a Cotação. Se ele recusar ou fechar a pergunta, devolve que nada foi reservado; nunca diga que a viagem está reservada nesse caso. " +
  "Se a Saída não tiver Vagas para o Grupo inteiro (cada criança ocupa uma Vaga), devolve VAGAS_INSUFICIENTES com as Saídas mais próximas que cabem o Grupo em sugestoes, sem perguntar nada. Se a Proposta expirar (ela vale 15 minutos) ou as Vagas acabarem antes da resposta, devolve o erro, sem Pré-reserva. " +
  "Se o cliente não consegue fazer a pergunta, nada é reservado, e o viajante pode reservar no chat web do Roteiro IA.";

/**
 * The person said no: an ordinary result, not an error, so the model tells
 * them nothing was reserved. The Proposta holds no Vagas and expires alone.
 */
const NAO_CONFIRMOU = {
  ok: true as const,
  confirmada: false as const,
  mensagem:
    "O viajante não confirmou a Pré-reserva, e nada foi reservado. Não diga que a viagem está reservada; se ele quiser, prepare uma nova Proposta.",
};

/**
 * A client that cannot ask the question: fail closed, never reserve. Shaped
 * like a Falha, with a code of the MCP's own (the catalog never refuses this).
 */
const SEM_PERGUNTA = {
  ok: false as const,
  erro: "CONFIRMACAO_INDISPONIVEL",
  mensagem:
    "Este cliente não consegue pedir a confirmação do viajante, e só ele pode confirmar uma Pré-reserva: nada foi reservado. Diga isso ao viajante e que ele pode fazer a reserva no chat web do Roteiro IA.",
};

/**
 * The capabilities the client declared: on 2026-07-28 in each request's
 * envelope, on 2025 once, at the handshake.
 */
function capacidadesDoCliente(
  servidor: McpServer,
  ctx: ServerContext,
): ClientCapabilities | undefined {
  // The SDK 2.4.0 types ship `RequestMetaEnvelope` as `{}`, so the key the
  // SDK itself reads (`_inputRequestCapabilityView`) has to be cast here.
  const envelope = ctx.mcpReq.envelope as
    | Record<string, ClientCapabilities | undefined>
    | undefined;
  return (
    envelope?.[CLIENT_CAPABILITIES_META_KEY] ??
    servidor.server.getClientCapabilities()
  );
}

/** Whether the client asks form questions: a bare `elicitation: {}` counts (the spec's older reading). */
function perguntaEmFormulario(capacidades: ClientCapabilities | undefined) {
  const elicitacao = capacidades?.elicitation;
  if (!elicitacao) return false;
  return elicitacao.form !== undefined || elicitacao.url === undefined;
}

/** The key of the one question in the confirmation request. */
const CHAVE_DA_PERGUNTA = "confirmacao";

const confirmacao = z.object({
  confirmar: z
    .boolean()
    .describe("Marque para confirmar a Pré-reserva com estes dados."),
});

/**
 * The MCP server over a catalog already built. Each Ferramenta comes from the
 * catalog's single list, with its own name, input schema and description.
 * The four reads are free; propor_pre_reserva only reserves when the person
 * confirms a question the server asks (docs/adr/0008). No Assistente here:
 * in MCP the model is the client's.
 */
export function criarServidorMcp(
  catalogo: Catalogo,
  { chaveDoEstado = CHAVE_DO_PROCESSO }: OpcoesDoServidorMcp = {},
): McpServer {
  const estado = createRequestStateCodec<EstadoDaPergunta>({
    key: chaveDoEstado,
    ttlSeconds: VALIDADE_DO_ESTADO_S,
  });
  const servidor = new McpServer(
    { name: "roteiro-ia", version: "0.1.0" },
    { requestState: { verify: estado.verify } },
  );
  for (const ferramenta of catalogo.ferramentas) {
    if (!ferramenta.somenteLeitura) continue;
    servidor.registerTool(
      ferramenta.nome,
      {
        description: ferramenta.descricao,
        inputSchema: ferramenta.schemaDeEntrada,
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (entrada) => resultadoMcp(await ferramenta.executar(entrada)),
    );
  }
  registrarProporPreReserva(servidor, catalogo, estado);
  return servidor;
}

function registrarProporPreReserva(
  servidor: McpServer,
  catalogo: Catalogo,
  estado: RequestStateCodec<EstadoDaPergunta>,
) {
  const ferramenta = catalogo.ferramentas.find(
    (f) => f.nome === "propor_pre_reserva",
  );
  if (!ferramenta) throw new Error("propor_pre_reserva fora do catálogo");
  servidor.registerTool(
    ferramenta.nome,
    {
      description: DESCRICAO_DA_PROPOSTA,
      inputSchema: ferramenta.schemaDeEntrada,
      // Hints only: the guarantee is the question below (docs/adr/0008).
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (entrada, ctx) => {
      // Already verified by the codec: a forged or expired one never gets here.
      const estadoDevolvido = ctx.mcpReq.requestState<EstadoDaPergunta>();
      if (estadoDevolvido) {
        const resposta = acceptedContent(
          ctx.mcpReq.inputResponses,
          CHAVE_DA_PERGUNTA,
          confirmacao,
        );
        // Declined, cancelled, unchecked or anything else: not a confirmation.
        if (resposta?.confirmar !== true) return resultadoMcp(NAO_CONFIRMOU);
        return resultadoMcp(
          await confirmarComCotacao(catalogo, estadoDevolvido.proposta),
        );
      }
      // Before any Proposta: one this client cannot ask about is useless.
      if (!perguntaEmFormulario(capacidadesDoCliente(servidor, ctx))) {
        return resultadoMcp(SEM_PERGUNTA);
      }
      const proposta = await catalogo.proporPreReserva(
        entrada as Parameters<Catalogo["proporPreReserva"]>[0],
      );
      if (!proposta.ok) return resultadoMcp(proposta);
      return inputRequired({
        inputRequests: {
          [CHAVE_DA_PERGUNTA]: inputRequired.elicit({
            message: resumoDaProposta(proposta),
            requestedSchema: confirmacao,
          }),
        },
        requestState: await estado.mint({ proposta: proposta.id }),
      });
    },
  );
}

/**
 * Confirms the Proposta and hands back the Pré-reserva with its Cotação, so
 * the client's model can tell the person what was reserved and for how much.
 * confirmarPreReserva already checked the price is the Proposta's.
 */
async function confirmarComCotacao(catalogo: Catalogo, idDaProposta: string) {
  const confirmada = await catalogo.confirmarPreReserva(idDaProposta);
  if (!confirmada.ok) return confirmada;
  const { pacote, data, grupo } = confirmada.preReserva;
  const cotada = await catalogo.consultarPreco({ pacote, data, grupo });
  if (!cotada.ok) return confirmada;
  const { ok: _, ...cotacao } = cotada;
  return { ...confirmada, cotacao };
}

type PropostaFeita = Extract<
  Awaited<ReturnType<Catalogo["proporPreReserva"]>>,
  { ok: true }
>;

const REAIS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
// A Saída is a calendar date: formatting it in UTC keeps the day as written.
const DATA = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
// The Proposta's validity in São Paulo time, the catalog's.
const HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** What the person reads in the question: everything they are confirming. */
function resumoDaProposta({ cotacao, expiraEm }: PropostaFeita): string {
  const { adultos, criancas } = cotacao.grupo;
  const grupo = [`${adultos} ${adultos === 1 ? "adulto" : "adultos"}`];
  if (criancas.length > 0) {
    const idades = criancas.map((idade) => `${idade} anos`).join(", ");
    grupo.push(
      `${criancas.length} ${criancas.length === 1 ? "criança" : "crianças"} (${idades})`,
    );
  }
  return [
    "Confirma a Pré-reserva?",
    `Pacote: ${cotacao.pacote.nome} (${cotacao.pacote.noites} noites)`,
    `Saída: ${DATA.format(new Date(`${cotacao.data}T00:00:00Z`))}`,
    `Grupo: ${grupo.join(" e ")}`,
    `Total: ${REAIS.format(cotacao.total / 100)}`,
    `Esta Proposta vale até ${HORA.format(new Date(expiraEm))} (horário de Brasília). Confirmando, as Vagas ficam seguras por 24 horas.`,
  ].join("\n");
}

/**
 * Success goes back as structured content plus the same JSON as text, which
 * the spec asks for older clients. A Falha is a tool error the client's model
 * reads and recovers from: `isError`, with the mensagem and the sugestoes.
 */
function resultadoMcp(
  resultado: { ok: true } | Falha | typeof SEM_PERGUNTA,
): CallToolResult {
  const content = [{ type: "text" as const, text: JSON.stringify(resultado) }];
  if (!resultado.ok) return { isError: true, content };
  return { content, structuredContent: resultado };
}
