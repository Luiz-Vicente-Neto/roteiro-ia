"use client";

// PROTOTYPE: the fake Conversa around the variants, and the floating switcher.
import { useRouter } from "next/navigation";
import { type ComponentType, useEffect, useState } from "react";
import {
  CONVERSA,
  ESTADOS_NA_URL,
  type EstadoDaProposta,
  type PropsDaResposta,
} from "./dados-falsos";
import { NOME_A, RespostaA } from "./variante-a";
import { NOME_B, RespostaB } from "./variante-b";
import { NOME_C, RespostaC } from "./variante-c";

const VARIANTES: Record<
  string,
  { nome: string; Resposta: ComponentType<PropsDaResposta> }
> = {
  A: { nome: NOME_A, Resposta: RespostaA },
  B: { nome: NOME_B, Resposta: RespostaB },
  C: { nome: NOME_C, Resposta: RespostaC },
};
const CHAVES = Object.keys(VARIANTES);

type EstadoNaUrl = (typeof ESTADOS_NA_URL)[number];

export function Prototipo(props: { variant?: string; proposta?: string }) {
  const router = useRouter();
  const variante = CHAVES.includes(props.variant ?? "")
    ? (props.variant as string)
    : "A";
  const naUrl = ESTADOS_NA_URL.includes(props.proposta as EstadoNaUrl)
    ? (props.proposta as EstadoNaUrl)
    : "valida";
  // Descartar is not one of the card's four states: kept out of the URL.
  const [descartada, setDescartada] = useState(false);
  const estado: EstadoDaProposta =
    descartada && naUrl === "valida" ? "descartada" : naUrl;

  function ir(v: string, p: EstadoNaUrl) {
    setDescartada(false);
    router.replace(`?variant=${v}&proposta=${p}`, { scroll: false });
  }
  const girar = (passo: number) =>
    ir(
      CHAVES[
        (CHAVES.indexOf(variante) + passo + CHAVES.length) % CHAVES.length
      ],
      naUrl,
    );

  // biome-ignore lint/correctness/useExhaustiveDependencies: prototype
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") girar(-1);
      if (e.key === "ArrowRight") girar(1);
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [variante, naUrl]);

  const { nome, Resposta } = VARIANTES[variante];

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 pb-32">
        <ol className="flex flex-1 flex-col gap-3">
          {CONVERSA.map((m) =>
            m.de === "viajante" ? (
              <li
                key={m.id}
                className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl bg-teal-700 px-4 py-2 text-white"
              >
                {m.texto}
              </li>
            ) : (
              <li key={m.id}>
                <Resposta
                  // Remount on switch so no variant keeps another's open rows.
                  key={variante}
                  resposta={m}
                  estado={estado}
                  aoConfirmar={() => ir(variante, "confirmada")}
                  aoDescartar={() => setDescartada(true)}
                />
              </li>
            ),
          )}
          {/* Evento (#15): a discreet line, not a bubble. */}
          {estado === "confirmada" && (
            <li className="self-center text-stone-500 text-xs">
              ✔ Pré-reserva RT-7K2M confirmada
            </li>
          )}
          {estado === "descartada" && (
            <li className="self-center text-stone-500 text-xs">
              ✕ Proposta descartada
            </li>
          )}
        </ol>

        <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
          <input
            placeholder="Ex.: 4 dias em Gramado em julho, casal, até R$ 4 mil"
            className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2"
          />
          <button
            type="submit"
            className="rounded-full bg-teal-700 px-5 py-2 font-medium text-white"
          >
            Enviar
          </button>
        </form>
      </div>

      {/* Loud on purpose: not part of the design under evaluation. */}
      <nav className="-translate-x-1/2 fixed bottom-3 left-1/2 z-50 flex w-max max-w-[calc(100vw-1rem)] flex-col items-center gap-1.5 rounded-2xl bg-fuchsia-950 px-3 py-2 text-sm text-white shadow-2xl ring-2 ring-fuchsia-400">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => girar(-1)}
            aria-label="Variante anterior"
            className="rounded-lg px-2 py-1 hover:bg-white/15"
          >
            ←
          </button>
          <span className="min-w-44 text-center font-semibold">
            {variante} ({nome})
          </span>
          <button
            type="button"
            onClick={() => girar(1)}
            aria-label="Próxima variante"
            className="rounded-lg px-2 py-1 hover:bg-white/15"
          >
            →
          </button>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-fuchsia-300">Proposta:</span>
          {ESTADOS_NA_URL.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => ir(variante, e)}
              className={`rounded-md px-2 py-1 ${
                e === naUrl && !descartada
                  ? "bg-white text-fuchsia-950"
                  : "hover:bg-white/15"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        <code className="text-[10px] text-fuchsia-300">
          ?variant={variante}&proposta={estado}
        </code>
      </nav>
    </>
  );
}
