"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ASSISTENTE_INDISPONIVEL } from "@/assistente/mensagens";
import { cardsDaResposta, chamadasDaResposta } from "@/assistente/resposta";
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
}: {
  conversa?: string;
  mensagens?: UIMessage[];
}) {
  const [texto, setTexto] = useState("");
  const idDaConversa = useRef(conversa);
  const [transport] = useState(() => transporte(idDaConversa));
  const { messages, sendMessage, status, error } = useChat({
    messages: mensagens,
    transport,
  });

  useEffect(() => {
    if (idDaConversa.current) return;
    const nova = conversaDa(messages.findLast((m) => m.role === "assistant"));
    if (!nova) return;
    idDaConversa.current = nova;
    // Without a navigation, so the answer keeps streaming on screen.
    window.history.replaceState(null, "", `/c/${nova}`);
  }, [messages]);
  const ocupado = status === "submitted" || status === "streaming";

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const mensagem = texto.trim();
    if (!mensagem || ocupado) return;
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
            <RespostaDoAssistente key={mensagem.id} mensagem={mensagem} />
          ),
        )}
        {status === "submitted" && (
          <li className="self-start text-sm text-stone-500">
            O Assistente está pensando…
          </li>
        )}
      </ol>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-amber-50 px-4 py-2 text-amber-900"
        >
          {/* Never the technical detail, even for a failure outside the stream. */}
          {ASSISTENTE_INDISPONIVEL}
        </p>
      )}

      <form onSubmit={enviar} className="flex gap-2">
        <label htmlFor="mensagem" className="sr-only">
          Sua mensagem
        </label>
        <input
          id="mensagem"
          value={texto}
          onChange={(e) => setTexto(e.currentTarget.value)}
          placeholder="Ex.: 4 dias em Gramado em julho, casal, até R$ 4 mil"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2"
        />
        <button
          type="submit"
          disabled={ocupado || !texto.trim()}
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

/**
 * The Assistente's text in its bubble, then the Cotação cards and the panel.
 * The cards' numbers come from the tool results, never from the text.
 */
function RespostaDoAssistente({ mensagem }: { mensagem: UIMessage }) {
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
      <PainelDeChamadas chamadas={chamadasDaResposta(mensagem)} />
    </li>
  );
}
