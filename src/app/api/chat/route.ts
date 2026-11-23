import { createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { donoDaVisita, obterAssistente } from "@/app/servidor";
import { CONVERSA_CHEIA, LIMITE_ATINGIDO } from "@/assistente";

// Thin layer: wiring only, no rules.

/** What the chat sends: the Viajante's new text, and the Conversa unless it is a new one. */
const Corpo = z.object({
  conversa: z.string().min(1).optional(),
  texto: z.string().trim().min(1),
});

/**
 * Where the message came from, for the Limitador: the client's address the
 * host's proxy puts first in x-forwarded-for. Without it (`next dev`), every
 * message shares one origem.
 */
function origemDo(request: Request): string {
  const primeiro = request.headers.get("x-forwarded-for")?.split(",")[0];
  return primeiro?.trim() || "local";
}

export async function POST(request: Request) {
  const dono = await donoDaVisita();
  if (!dono) {
    return Response.json({ erro: "Visita sem dono." }, { status: 401 });
  }
  const corpo = Corpo.safeParse(await request.json().catch(() => undefined));
  if (!corpo.success) {
    return Response.json(
      { erro: "A mensagem precisa ser um texto do Viajante." },
      { status: 400 },
    );
  }

  const envio = await obterAssistente().enviarMensagem({
    dono,
    origem: origemDo(request),
    ...corpo.data,
  });
  if (!envio.ok && envio.erro === LIMITE_ATINGIDO) {
    // The browser shows "muitas mensagens em pouco tempo" for this erro.
    return Response.json({ erro: envio.erro }, { status: 429 });
  }
  if (!envio.ok && envio.erro === CONVERSA_CHEIA) {
    // The browser shows "comece uma nova Conversa" for this erro.
    return Response.json({ erro: envio.erro }, { status: 409 });
  }
  if (!envio.ok) {
    return Response.json({ erro: "Conversa não encontrada." }, { status: 404 });
  }
  return createUIMessageStreamResponse({ stream: envio.stream });
}
