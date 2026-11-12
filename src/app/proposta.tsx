"use client";

import Image from "next/image";
import type { Evento } from "@/assistente/base";
import type { EstadoDaProposta, PropostaDoCard } from "@/assistente/resposta";
import { dataLonga, diaEHora, grupoPorExtenso, hora, reais } from "./formato";
import { fotoDoDestino } from "./fotos";

/** What the card shows: the Proposta's current state, or the refusal of a click. */
export type EstadoDoCard =
  | EstadoDaProposta
  | { estado: "erro"; mensagem: string };

const CARIMBO: Record<EstadoDoCard["estado"], { texto: string; cor: string }> =
  {
    valida: { texto: "A confirmar", cor: "border-teal-700 text-teal-700" },
    confirmada: {
      texto: "Confirmada",
      cor: "border-emerald-600 text-emerald-600",
    },
    expirada: { texto: "Expirada", cor: "border-stone-500 text-stone-500" },
    descartada: { texto: "Descartada", cor: "border-stone-500 text-stone-500" },
    erro: { texto: "Não confirmada", cor: "border-red-600 text-red-600" },
  };

const PECA_OUTRA = "Peça uma nova Proposta na conversa.";

function detalheDo(estado: EstadoDoCard): string {
  switch (estado.estado) {
    case "valida":
      return `Vale até ${hora(estado.expiraEm)}. Só a sua confirmação bloqueia as Vagas.`;
    case "confirmada":
      return `Vagas bloqueadas até ${diaEHora(estado.bloqueadaAte)}.`;
    case "expirada":
      return `Esta Proposta expirou. ${PECA_OUTRA}`;
    case "descartada":
      return `Você descartou esta Proposta. ${PECA_OUTRA}`;
    case "erro":
      // The catalog's refusals already say what to ask for next.
      return estado.mensagem;
  }
}

/**
 * A Proposta as a ticket: photo on top, Pacote, Saída and Grupo, a tear line,
 * then the total, or the Pré-reserva's code once confirmed. A tilted stamp
 * shows the state; only a valid one has the buttons.
 */
export function CardDeProposta({
  proposta,
  estado,
  ocupado,
  aoConfirmar,
  aoDescartar,
}: {
  proposta: PropostaDoCard;
  estado: EstadoDoCard;
  ocupado: boolean;
  aoConfirmar(): void;
  aoDescartar(): void;
}) {
  const c = proposta.cotacao;
  const foto = fotoDoDestino(c.pacote.destino.slug);
  const apagada =
    estado.estado === "expirada" || estado.estado === "descartada";
  const carimbo = CARIMBO[estado.estado];
  const rotulo = (texto: string) => (
    <dt className="text-[10px] text-stone-500 uppercase tracking-wide">
      {texto}
    </dt>
  );
  return (
    <article
      aria-label={`Proposta: ${c.pacote.nome}, ${carimbo.texto}`}
      className="relative overflow-hidden rounded-2xl bg-white shadow-md"
    >
      <div
        className={`relative h-24 bg-stone-700 ${apagada ? "grayscale" : ""}`}
      >
        {foto && (
          <Image
            src={foto.src}
            alt={`Foto de ${c.pacote.destino.nome}`}
            fill
            sizes="(max-width: 672px) 100vw, 640px"
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
        <p className="absolute bottom-2 left-4 font-bold text-2xl text-white">
          {c.pacote.destino.nome}
        </p>
        {foto && (
          <p className="absolute top-1 right-2 text-[10px] text-white/80">
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
      <span
        aria-hidden
        className={`-rotate-6 absolute top-28 right-4 rounded border-2 bg-white/80 px-2 py-0.5 font-bold text-xs uppercase tracking-widest ${carimbo.cor}`}
      >
        {carimbo.texto}
      </span>
      <dl
        className={`grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm ${apagada ? "opacity-50" : ""}`}
      >
        <div className="col-span-2 pr-28">
          {rotulo("Pacote")}
          <dd className="font-semibold">{c.pacote.nome}</dd>
          <dd className="text-stone-600">
            {c.pacote.hotel.nome} · {c.pacote.noites} noites
          </dd>
        </div>
        <div>
          {rotulo("Saída")}
          <dd className="font-semibold">{dataLonga(c.data)}</dd>
        </div>
        <div>
          {rotulo("Grupo")}
          <dd className="font-semibold">{grupoPorExtenso(c.grupo)}</dd>
        </div>
      </dl>
      {/* The tear line, with a notch on each side. */}
      <div className="relative border-stone-300 border-t-2 border-dashed">
        <span className="-left-3 -top-3 absolute size-6 rounded-full bg-stone-50" />
        <span className="-right-3 -top-3 absolute size-6 rounded-full bg-stone-50" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div
          className={`flex items-end justify-between gap-3 ${apagada ? "opacity-50" : ""}`}
        >
          <div>
            <p className="text-[10px] text-stone-500 uppercase tracking-wide">
              {estado.estado === "confirmada"
                ? "Código da Pré-reserva"
                : `Total, ${grupoPorExtenso(c.grupo)}`}
            </p>
            <p className="font-bold font-mono text-2xl tabular-nums">
              {estado.estado === "confirmada" ? estado.codigo : reais(c.total)}
            </p>
          </div>
          {estado.estado === "confirmada" && (
            <p className="text-right font-semibold tabular-nums">
              {reais(c.total)}
            </p>
          )}
        </div>
        <p
          role={estado.estado === "erro" ? "alert" : undefined}
          className={`text-sm ${estado.estado === "erro" ? "text-red-800" : "text-stone-600"}`}
        >
          {detalheDo(estado)}
        </p>
        {estado.estado === "valida" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={aoDescartar}
              disabled={ocupado}
              className="rounded-xl px-4 py-2.5 font-medium text-stone-600 disabled:opacity-50"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={aoConfirmar}
              disabled={ocupado}
              className="flex-1 rounded-xl bg-teal-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              Confirmar pré-reserva
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

/** An Evento as a discreet, centered line below the answer. */
export function LinhaDeEvento({ evento }: { evento: Evento }) {
  return (
    <p className="self-center text-stone-500 text-xs">
      {evento.tipo === "proposta-confirmada"
        ? `✔ Pré-reserva ${evento.codigo} confirmada`
        : "✕ Proposta descartada"}
    </p>
  );
}
