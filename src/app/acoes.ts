"use server";

// Server Actions: wiring only, no rules. The assistente module checks the dono.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { donoDaVisita, obterAssistente } from "@/app/servidor";
import { propostaInexistente } from "@/assistente";

/**
 * Deletes the Conversa `conversa` of this visit's dono. When it is the one on
 * screen (`aberta`), the browser goes to a new Conversa instead of a 404.
 */
export async function apagarConversa(conversa: string, aberta: boolean) {
  const dono = await donoDaVisita();
  if (!dono) return;
  await obterAssistente().apagarConversa({ dono, conversa });
  // Before the redirect, which throws: the sidebar must drop it either way.
  revalidatePath("/", "layout");
  if (aberta) redirect("/");
}

/**
 * The Viajante's click on Confirmar pré-reserva: the only path that makes a
 * Pré-reserva, with no model in between (docs/adr/0003).
 */
export async function confirmarProposta(conversa: string, proposta: string) {
  const dono = await donoDaVisita();
  // Without a dono, no Proposta is theirs.
  if (!dono) return propostaInexistente();
  const resultado = await obterAssistente().confirmarProposta({
    dono,
    conversa,
    proposta,
  });
  // The Conversa's última atividade changed, so its place in the sidebar too.
  revalidatePath("/", "layout");
  return resultado;
}

/** The Viajante's click on Descartar: only an Evento, nothing in the catalog. */
export async function descartarProposta(conversa: string, proposta: string) {
  const dono = await donoDaVisita();
  if (!dono) return propostaInexistente();
  const resultado = await obterAssistente().descartarProposta({
    dono,
    conversa,
    proposta,
  });
  revalidatePath("/", "layout");
  return resultado;
}
