// PROTOTYPE, throwaway. Do not merge into main.
//
// Question (tickets #12 and #15): what should the cards de Cotação, the panel
// "como cheguei nessa resposta" and the card de Proposta look like?
//
// Three variants of an Assistente answer, switchable via `?variant=A|B|C`, with
// the Proposta state via `?proposta=valida|confirmada|expirada|erro`. Fake
// data, no model, no catalog. It is its own route and not `/` because the real
// Conversa needs a model to produce anything; the shell copies the real page.
//
// Run: `pnpm prototipo`, then open http://localhost:3000/prototipo-cards
import { notFound } from "next/navigation";
import { Prototipo } from "./prototipo";

export default async function PaginaDoPrototipo({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string; proposta?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { variant, proposta } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="font-bold text-3xl">🧭 Roteiro IA</h1>
        <p className="text-stone-600">
          Um assistente de viagens que responde com dados reais, sem inventar
          preço nenhum.
        </p>
      </header>
      <Prototipo variant={variant} proposta={proposta} />
    </main>
  );
}
