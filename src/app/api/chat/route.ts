import {
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  type UIMessage,
} from "ai";
import { type Assistente, criarAssistente, resolverModelo } from "@/assistente";
import { criarCatalogo, relogioDoSistema } from "@/catalogo";
import { criarBasePostgres } from "@/db/base-postgres";
import { createDb } from "@/db/client";
import { databaseUrl } from "@/db/env";

// Thin layer: wiring only, no rules.
let assistente: Assistente | undefined;

/**
 * Built on the first request, not on import, so `next build` needs no key.
 * src/instrumentation.ts already checked MODELO and its key at server start.
 */
function obterAssistente() {
  if (!assistente) {
    const relogio = relogioDoSistema();
    assistente = criarAssistente({
      modelo: resolverModelo(process.env),
      catalogo: criarCatalogo({
        base: criarBasePostgres(createDb(databaseUrl())),
        relogio,
      }),
      relogio,
    });
  }
  return assistente;
}

/** The text of the Viajante's new message, the last one `useChat` sends. */
function textoDaNovaMensagem(mensagem: UIMessage | undefined) {
  if (mensagem?.role !== "user") return undefined;
  const texto = mensagem.parts
    .flatMap((p) => (p.type === "text" ? [p.text] : []))
    .join("\n")
    .trim();
  return texto || undefined;
}

export async function POST(request: Request) {
  const corpo: unknown = await request.json().catch(() => undefined);
  const validacao = await safeValidateUIMessages({
    messages: (corpo as { messages?: unknown } | undefined)?.messages,
  });
  if (!validacao.success) {
    return Response.json({ erro: "Mensagens inválidas." }, { status: 400 });
  }
  const historico = validacao.data.slice(0, -1);
  const texto = textoDaNovaMensagem(validacao.data.at(-1));
  if (!texto) {
    return Response.json(
      { erro: "A última mensagem precisa ser um texto do Viajante." },
      { status: 400 },
    );
  }

  return createUIMessageStreamResponse({
    stream: obterAssistente().enviarMensagem({ historico, texto }),
  });
}
