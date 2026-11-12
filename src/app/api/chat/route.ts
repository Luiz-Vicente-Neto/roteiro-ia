import { createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { donoDaVisita, obterAssistente } from "@/app/servidor";

// Thin layer: wiring only, no rules.

/** What the chat sends: the Viajante's new text, and the Conversa unless it is a new one. */
const Corpo = z.object({
  conversa: z.string().min(1).optional(),
  texto: z.string().trim().min(1),
});

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

  const envio = await obterAssistente().enviarMensagem({ dono, ...corpo.data });
  if (!envio.ok) {
    return Response.json({ erro: "Conversa não encontrada." }, { status: 404 });
  }
  return createUIMessageStreamResponse({ stream: envio.stream });
}
