"use client";

import { useChat } from "@ai-sdk/react";
import { isToolUIPart, type UIMessage } from "ai";
import { type FormEvent, useState } from "react";
import { ASSISTENTE_INDISPONIVEL } from "@/assistente/mensagens";
import { cardsDaResposta, chamadasDaResposta } from "@/assistente/resposta";
import { CardsDeCotacao, PainelDeChamadas } from "./resposta";

export function Conversa() {
  const [texto, setTexto] = useState("");
  const { messages, sendMessage, status, error } = useChat();
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

function textoDe(mensagem: UIMessage): string {
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
