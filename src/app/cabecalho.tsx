export function Cabecalho() {
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">🧭 Roteiro IA</h1>
        <p className="text-stone-600">
          Um assistente de viagens que responde com dados reais, sem inventar
          preço nenhum.
        </p>
      </div>
      {/* A full load, so the new Conversa starts from an empty screen. */}
      <a
        href="/"
        className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm text-stone-700 shadow-sm ring-1 ring-stone-200"
      >
        Nova Conversa
      </a>
    </header>
  );
}
