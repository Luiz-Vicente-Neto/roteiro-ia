import { notFound } from "next/navigation";
import { Cabecalho } from "@/app/cabecalho";
import { Conversa } from "@/app/conversa";
import { donoDaVisita, obterAssistente } from "@/app/servidor";
import { eventosDe, mensagensDe } from "@/assistente";

/** Reopens a Conversa by its link. For anyone but its dono, it does not exist. */
export default async function PaginaDaConversa({
  params,
}: PageProps<"/c/[id]">) {
  const { id } = await params;
  const dono = await donoDaVisita();
  const assistente = obterAssistente();
  const itens =
    dono && (await assistente.abrirConversa({ dono, conversa: id }));
  // Read now, never from the message: a Proposta may have expired since.
  const estados =
    dono && (await assistente.estadosDasPropostas({ dono, conversa: id }));
  if (!itens || !estados) notFound();
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <Cabecalho />
      <Conversa
        key={id}
        conversa={id}
        mensagens={mensagensDe(itens)}
        eventos={eventosDe(itens)}
        estados={estados}
      />
    </main>
  );
}
