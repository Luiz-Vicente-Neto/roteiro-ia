"use server";

// Server Actions: wiring only, no rules. The assistente module checks the dono.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { donoDaVisita, obterAssistente } from "@/app/servidor";

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
