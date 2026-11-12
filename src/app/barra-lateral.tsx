"use client";

import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import type { ConversaDaLista } from "@/assistente";
import { apagarConversa } from "./acoes";

const DIA_E_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/**
 * The Viajante's Conversas, the most recent first, with "Nova Conversa".
 * On a phone it is collapsed behind a button; from `md` up it stays open.
 */
export function BarraLateral({ conversas }: { conversas: ConversaDaLista[] }) {
  const [aberta, setAberta] = useState(false);
  const caminho = usePathname();
  return (
    <aside className="border-b border-stone-200 bg-white md:sticky md:top-0 md:h-screen md:w-72 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setAberta((a) => !a)}
          aria-expanded={aberta}
          aria-controls="lista-de-conversas"
          className="rounded-full px-3 py-1.5 text-sm text-stone-700 ring-1 ring-stone-200 md:hidden"
        >
          {aberta ? "Fechar" : "Minhas Conversas"}
        </button>
        <h2 className="hidden text-sm font-semibold text-stone-600 md:block">
          Minhas Conversas
        </h2>
        {/* A full load, so the new Conversa starts from an empty screen. */}
        <a
          href="/"
          className="shrink-0 rounded-full bg-teal-700 px-3 py-1.5 text-sm font-medium text-white"
        >
          Nova Conversa
        </a>
      </div>
      <nav
        id="lista-de-conversas"
        aria-label="Minhas Conversas"
        className={`${aberta ? "block" : "hidden"} px-2 pb-3 md:block`}
      >
        {conversas.length === 0 ? (
          <p className="px-2 text-sm text-stone-500">Nenhuma Conversa ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {conversas.map((c) => (
              <ItemDaLista
                key={c.id}
                conversa={c}
                atual={caminho === `/c/${c.id}`}
              />
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}

function ItemDaLista({
  conversa: c,
  atual,
}: {
  conversa: ConversaDaLista;
  atual: boolean;
}) {
  const [apagando, iniciar] = useTransition();
  const titulo = c.titulo || "Conversa sem título";
  function apagar() {
    if (!window.confirm(`Apagar a Conversa "${titulo}"?`)) return;
    iniciar(() => apagarConversa(c.id, atual));
  }
  return (
    <li
      className={`group flex items-center gap-1 rounded-lg ${
        atual ? "bg-teal-50" : "hover:bg-stone-100"
      } ${apagando ? "opacity-50" : ""}`}
    >
      <a
        href={`/c/${c.id}`}
        aria-current={atual ? "page" : undefined}
        className="min-w-0 flex-1 px-2 py-2"
      >
        <span className="block truncate text-sm">{titulo}</span>
        <span className="block text-xs text-stone-500">
          {DIA_E_HORA.format(c.ultimaAtividade)}
        </span>
      </a>
      <button
        type="button"
        onClick={apagar}
        disabled={apagando}
        aria-label={`Apagar a Conversa "${titulo}"`}
        title="Apagar Conversa"
        className="shrink-0 rounded-md px-2 py-1 text-stone-400 hover:bg-stone-200 hover:text-red-700"
      >
        🗑
      </button>
    </li>
  );
}
