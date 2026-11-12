"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import type { EventoDaConversa } from "@/assistente/base";
import {
  ASSISTENTE_INDISPONIVEL,
  COMECE_UMA_NOVA_CONVERSA,
  CONVERSA_CHEIA,
} from "@/assistente/mensagens";
import {
  cardsDaResposta,
  chamadasDaResposta,
  type EstadoDaProposta,
  type PropostaDoCard,
  propostasDaResposta,
} from "@/assistente/resposta";
import { confirmarProposta, descartarProposta } from "./acoes";
import { CardDeProposta, type EstadoDoCard, LinhaDeEvento } from "./proposta";
import { CardsDeCotacao, PainelDeChamadas } from "./resposta";

/** Sends only the new text: the server holds the Conversa's history. */
function transporte(conversa: { current: string | undefined }) {
  return new DefaultChatTransport({
    api: "/api/chat",
    prepareSendMessagesRequest: ({ messages }) => ({
      body: { conversa: conversa.current, texto: textoDe(messages.at(-1)) },
    }),
  });
}

/** The Conversa sent by the server in the answer's metadata, if any. */
function conversaDa(mensagem: UIMessage | undefined): string | undefined {
  const metadados = mensagem?.metadata as { conversa?: unknown } | undefined;
  return typeof metadados?.conversa === "string"
    ? metadados.conversa
    : undefined;
}

/**
 * The screen of one Conversa. Without `conversa` it is a new one: the server
 * creates it on the first message, and the address becomes its link.
 */
export function Conversa({
  conversa,
  mensagens = [],
  eventos: eventosIniciais = [],
  estados: estadosIniciais = {},
}: {
  conversa?: string;
  mensagens?: UIMessage[];
  eventos?: EventoDaConversa[];
  /** Each Proposta's state when the page was read, by id. */
  estados?: Record<string, EstadoDaProposta>;
}) {
  // Eventos and states the Viajante's clicks add, on top of the page's.
  const [eventos, setEventos] = useState(eventosIniciais);
  const [estados, setEstados] =
    useState<Record<string, EstadoDoCard>>(estadosIniciais);
  const [emAndamento, iniciar] = useTransition();
  const [texto, setTexto] = useState("");
  const idDaConversa = useRef(conversa);
  const [transport] = useState(() => transporte(idDaConversa));
  const router = useRouter();
  const { messages, setMessages, sendMessage, status, error } = useChat({
    messages: mensagens,
    transport,
    // So the sidebar shows this Conversa, with its new última atividade.
    onFinish: ({ isError, isAbort }) => {
      if (!isError && !isAbort) router.refresh();
    },
  });
  // The route answers 409 with this erro; the transport puts the body in the message.
  const cheia = error?.message.includes(CONVERSA_CHEIA) ?? false;

  useEffect(() => {
    if (!cheia) return;
    // The refused message was not kept: it leaves the list and goes back to
    // the input, so the Viajante can copy it into a new Conversa.
    setMessages((atuais) => {
      setTexto(textoDe(atuais.at(-1)));
      return atuais.slice(0, -1);
    });
  }, [cheia, setMessages]);

  useEffect(() => {
    if (idDaConversa.current) return;
    const nova = conversaDa(messages.findLast((m) => m.role === "assistant"));
    if (!nova) return;
    idDaConversa.current = nova;
    // Without a navigation, so the answer keeps streaming on screen.
    window.history.replaceState(null, "", `/c/${nova}`);
  }, [messages]);
  const ocupado = status === "submitted" || status === "streaming";

  /** A click on a Proposta's card: the Server Action answers its new state and Evento. */
  function aoClicar(proposta: string, acao: "confirmar" | "descartar") {
    const id = idDaConversa.current;
    if (!id) return;
    iniciar(async () => {
      let novo: EstadoDoCard;
      let evento: EventoDaConversa | undefined;
      if (acao === "confirmar") {
        const resultado = await confirmarProposta(id, proposta);
        if (resultado.ok) {
          const { codigo, expiraEm } = resultado.preReserva;
          novo = { estado: "confirmada", codigo, bloqueadaAte: expiraEm };
          evento = resultado.evento;
        } else {
          novo = { estado: "erro", mensagem: resultado.mensagem };
        }
      } else {
        const resultado = await descartarProposta(id, proposta);
        if (resultado.ok) {
          novo = { estado: "descartada" };
          evento = resultado.evento;
        } else {
          novo = { estado: "erro", mensagem: resultado.mensagem };
        }
      }
      setEstados((atuais) => ({ ...atuais, [proposta]: novo }));
      if (evento) setEventos((atuais) => [...atuais, evento]);
    });
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const mensagem = texto.trim();
    if (!mensagem || ocupado || cheia) return;
    sendMessage({ text: mensagem });
    setTexto("");
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ol className="flex flex-1 flex-col gap-3">
        {messages.map((mensagem) =>
          mensagem.role === "user" ? (
            <li
              key={mensagem.id}
              className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl bg-teal-700 px-4 py-2 text-white"
            >
              {textoDe(mensagem)}
            </li>
          ) : (
            <RespostaDoAssistente
              key={mensagem.id}
              mensagem={mensagem}
              eventos={eventos}
              estados={estados}
              ocupado={emAndamento}
              aoClicar={aoClicar}
            />
          ),
        )}
        {status === "submitted" && (
          <li className="self-start text-sm text-stone-500">
            O Assistente está pensando…
          </li>
        )}
      </ol>

      {cheia ? (
        <p
          role="alert"
          className="rounded-lg bg-teal-50 px-4 py-2 text-teal-900"
        >
          {COMECE_UMA_NOVA_CONVERSA}{" "}
          <a href="/" className="font-medium underline">
            Nova Conversa
          </a>
        </p>
      ) : (
        error && (
          <p
            role="alert"
            className="rounded-lg bg-amber-50 px-4 py-2 text-amber-900"
          >
            {/* Never the technical detail, even for a failure outside the stream. */}
            {ASSISTENTE_INDISPONIVEL}
          </p>
        )
      )}

      <form onSubmit={enviar} className="flex gap-2">
        <label htmlFor="mensagem" className="sr-only">
          Sua mensagem
        </label>
        <input
          id="mensagem"
          value={texto}
          onChange={(e) => setTexto(e.currentTarget.value)}
          placeholder="Ex.: 4 dias em Gramado em julho, casal, até R$ 6 mil"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2"
        />
        <button
          type="submit"
          disabled={ocupado || cheia || !texto.trim()}
          className="rounded-full bg-teal-700 px-5 py-2 font-medium text-white disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
      <p className="text-center text-xs text-stone-500">
        As mensagens são enviadas a um provedor de IA para gerar as respostas.
        Não escreva dados pessoais.
      </p>
    </div>
  );
}

function textoDe(mensagem: UIMessage | undefined): string {
  if (!mensagem) return "";
  return mensagem.parts
    .flatMap((p) => (p.type === "text" ? [p.text] : []))
    .join("");
}

/** A Proposta just made has no state from the page yet: it is valid until its expiry. */
function estadoDe(
  proposta: PropostaDoCard,
  estados: Record<string, EstadoDoCard>,
): EstadoDoCard {
  return (
    estados[proposta.id] ?? { estado: "valida", expiraEm: proposta.expiraEm }
  );
}

/**
 * The Assistente's text in its bubble, then the Cotação cards, the Proposta
 * cards with the Eventos about them, and the panel. The cards' numbers come
 * from the tool results, never from the text.
 */
function RespostaDoAssistente({
  mensagem,
  eventos,
  estados,
  ocupado,
  aoClicar,
}: {
  mensagem: UIMessage;
  eventos: EventoDaConversa[];
  estados: Record<string, EstadoDoCard>;
  ocupado: boolean;
  aoClicar(proposta: string, acao: "confirmar" | "descartar"): void;
}) {
  const propostas = propostasDaResposta(mensagem);
  const ids = new Set(propostas.map((p) => p.id));
  const sobreEstas = eventos.filter((e) => ids.has(e.evento.idDaProposta));
  const texto = textoDe(mensagem);
  const consultando = mensagem.parts.some(
    (p) =>
      isToolUIPart(p) &&
      p.state !== "output-available" &&
      p.state !== "output-error",
  );
  return (
    <li className="flex flex-col gap-3">
      {(texto || consultando) && (
        <p className="max-w-[85%] self-start whitespace-pre-wrap rounded-2xl bg-white px-4 py-2 shadow-sm">
          {texto}
          {consultando && (
            <span className="block text-sm text-stone-500">
              Consultando o catálogo…
            </span>
          )}
        </p>
      )}
      <CardsDeCotacao cards={cardsDaResposta(mensagem)} />
      {propostas.map((p) => (
        <CardDeProposta
          key={p.id}
          proposta={p}
          estado={estadoDe(p, estados)}
          ocupado={ocupado}
          aoConfirmar={() => aoClicar(p.id, "confirmar")}
          aoDescartar={() => aoClicar(p.id, "descartar")}
        />
      ))}
      {sobreEstas.map((e) => (
        <LinhaDeEvento key={e.id} evento={e.evento} />
      ))}
      <PainelDeChamadas chamadas={chamadasDaResposta(mensagem)} />
    </li>
  );
}
