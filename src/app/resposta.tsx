"use client";

import Image from "next/image";
import { useState } from "react";
import {
  type Chamada,
  type CotacaoDoCard,
  cardDetalhado,
  chaveDoCard,
} from "@/assistente/resposta";
import {
  dataCurta,
  dataLonga,
  grupoPorExtenso,
  periodoPorExtenso,
  poucasVagas,
  precosPorPessoa,
  reais,
  resumoDaChamada,
  vagasPorExtenso,
} from "./formato";
import { fotoDoDestino } from "./fotos";

/**
 * The Cotação cards of one answer. Several make a sideways carousel that
 * bleeds to the screen edge, so the next card peeks in; a single one takes
 * the whole width. A consultar_preco card also shows the price of each person.
 */
export function CardsDeCotacao({ cards }: { cards: CotacaoDoCard[] }) {
  if (cards.length === 0) return null;
  const unico = cards.length === 1;
  return (
    <ul
      aria-label="Cotações"
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2"
    >
      {cards.map((c) => (
        <li
          key={chaveDoCard(c)}
          className={`shrink-0 snap-center ${unico ? "w-full" : "w-[78%] max-w-72"}`}
        >
          <CardDeCotacao cotacao={c} largo={unico} />
        </li>
      ))}
    </ul>
  );
}

function CardDeCotacao({
  cotacao: c,
  largo,
}: {
  cotacao: CotacaoDoCard;
  largo: boolean;
}) {
  const foto = fotoDoDestino(c.pacote.destino.slug);
  return (
    <article
      className={`relative flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-stone-700 text-white shadow-md ${
        largo ? "min-h-80" : "aspect-3/4"
      }`}
    >
      {foto && (
        <Image
          src={foto.src}
          alt={`Foto de ${c.pacote.destino.nome}`}
          fill
          sizes="(max-width: 672px) 80vw, 640px"
          className="object-cover"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-black/30" />
      <div className="relative flex items-start justify-between gap-2 p-3">
        <span
          className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 font-semibold text-xs ${
            poucasVagas(c.vagasRestantes)
              ? "bg-amber-400 text-amber-950"
              : "bg-white/90 text-stone-800"
          }`}
        >
          {vagasPorExtenso(c.vagasRestantes)}
        </span>
        {foto && (
          <p className="text-right text-[10px] text-white/80">
            Foto:{" "}
            <a
              href={foto.link}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:underline"
            >
              {foto.autor}
            </a>{" "}
            /{" "}
            <a
              href="https://unsplash.com"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:underline"
            >
              Unsplash
            </a>
          </p>
        )}
      </div>
      <div className="relative flex flex-col gap-1 p-4">
        <p className="font-medium text-white/80 text-xs uppercase tracking-wide">
          {c.pacote.destino.nome} · {c.pacote.noites} noites
        </p>
        <h3 className="font-bold text-xl leading-tight">{c.pacote.nome}</h3>
        <p className="text-sm text-white/90">{c.pacote.hotel.nome}</p>
        <p className="text-sm text-white/90">Saída {dataLonga(c.data)}</p>
        {c.outrasSaidas && c.outrasSaidas.length > 0 && (
          <p className="text-white/70 text-xs">
            Também em {c.outrasSaidas.map(dataCurta).join(", ")}
          </p>
        )}
        {cardDetalhado(c) && (
          <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {precosPorPessoa(c).map((linha) => (
              <li
                key={linha}
                className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur"
              >
                {linha}
              </li>
            ))}
            <li className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">
              {periodoPorExtenso(c)}
            </li>
          </ul>
        )}
        <p className="mt-2 flex items-baseline justify-between gap-2 border-white/30 border-t pt-2">
          <span className="text-white/80 text-xs">
            Total, {grupoPorExtenso(c.grupo)}
          </span>
          <span className="font-bold text-2xl tabular-nums">
            {reais(c.total)}
          </span>
        </p>
      </div>
    </article>
  );
}

/** "Como cheguei nessa resposta": every tool call of the answer, in order. */
export function PainelDeChamadas({ chamadas }: { chamadas: Chamada[] }) {
  const [aberto, setAberto] = useState(false);
  if (chamadas.length === 0) return null;
  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-stone-600 shadow-sm ring-1 ring-stone-200"
      >
        <span className="flex" aria-hidden>
          {chamadas.map((ch) => (
            <span
              key={ch.id}
              className={`-ml-1 size-3 rounded-full ring-2 ring-white first:ml-0 ${ch.ok ? "bg-teal-600" : "bg-red-500"}`}
            />
          ))}
        </span>
        Como cheguei nessa resposta
        <span aria-hidden>{aberto ? "▴" : "▾"}</span>
      </button>
      {aberto && (
        <ol className="mt-3 ml-3 flex flex-col gap-4 border-stone-300 border-l-2 pl-5">
          {chamadas.map((ch) => (
            <li key={ch.id} className="relative min-w-0">
              <span
                className={`-left-6.75 absolute top-1 size-3 rounded-full ring-4 ring-stone-50 ${ch.ok ? "bg-teal-600" : "bg-red-500"}`}
              />
              <p className="font-medium">
                {ch.ok ? "Consultei" : "Tentei"} <code>{ch.ferramenta}</code>
              </p>
              <p
                className={`wrap-break-word ${ch.ok ? "text-stone-600" : "text-red-700"}`}
              >
                {resumoDaChamada(ch)}
              </p>
              <Json rotulo="Entrada" valor={ch.entrada} />
              {/* Not "Saída": that word is a Pacote's departure here. */}
              <Json rotulo="Resultado" valor={ch.saida} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Json({ rotulo, valor }: { rotulo: string; valor: unknown }) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-stone-500 text-xs">
        {rotulo}
      </summary>
      <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-stone-900 p-3 text-stone-100 text-xs">
        {JSON.stringify(valor, null, 2)}
      </pre>
    </details>
  );
}
