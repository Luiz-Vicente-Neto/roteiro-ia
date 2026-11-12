import { Conversa } from "./conversa";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-3xl font-bold">🧭 Roteiro IA</h1>
        <p className="text-stone-600">
          Um assistente de viagens que responde com dados reais, sem inventar
          preço nenhum.
        </p>
      </header>
      <Conversa />
    </main>
  );
}
