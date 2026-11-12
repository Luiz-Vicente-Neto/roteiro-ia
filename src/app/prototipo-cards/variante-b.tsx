"use client";

// PROTOTYPE, variant B: sideways carousel of photo-first cards with the text
// over the photo, the panel as a timeline, the Proposta as a ticket.
import { useState } from "react";
import {
  type Chamada,
  type Cotacao,
  credito,
  dataCurta,
  dataLonga,
  type EstadoDaProposta,
  foto,
  grupoPorExtenso,
  type Proposta,
  type PropsDaResposta,
  periodoPorExtenso,
  pessoaPorExtenso,
  poucasVagas,
  reais,
  textoDoEstado,
  vagasPorExtenso,
} from "./dados-falsos";

export const NOME_B = "Carrossel";

export function RespostaB({
  resposta,
  estado,
  aoConfirmar,
  aoDescartar,
}: PropsDaResposta) {
  const uma = resposta.cotacoes.length === 1;
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[85%] self-start whitespace-pre-wrap rounded-2xl bg-white px-4 py-2 shadow-sm">
        {resposta.texto}
      </p>
      {resposta.cotacoes.length > 0 && (
        // Bleeds to the screen edge so the next card peeks in.
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
          {resposta.cotacoes.map((c) => (
            <CardDeCotacao
              key={c.pacote.slug + c.data}
              cotacao={c}
              largo={uma}
              detalhar={resposta.detalhar}
            />
          ))}
        </div>
      )}
      {resposta.proposta && (
        <Bilhete
          proposta={resposta.proposta}
          estado={estado}
          aoConfirmar={aoConfirmar}
          aoDescartar={aoDescartar}
        />
      )}
      <Trilha chamadas={resposta.chamadas} />
    </div>
  );
}

function CardDeCotacao({
  cotacao: c,
  largo,
  detalhar,
}: {
  cotacao: Cotacao;
  largo: boolean;
  detalhar?: boolean;
}) {
  return (
    <article
      className={`relative flex shrink-0 snap-center flex-col justify-between overflow-hidden rounded-3xl bg-center bg-cover text-white shadow-md ${
        largo ? "min-h-80 w-full" : "aspect-[3/4] w-[72%] max-w-72"
      }`}
      style={foto(c.pacote.destino.slug)}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/30" />
      <div className="relative flex items-start justify-between gap-2 p-3">
        <span
          className={`rounded-full px-2.5 py-1 font-semibold text-xs ${
            poucasVagas(c.vagasRestantes)
              ? "bg-amber-400 text-amber-950"
              : "bg-white/90 text-stone-800"
          }`}
        >
          {vagasPorExtenso(c.vagasRestantes)}
        </span>
        <span className="text-right text-[10px] text-white/80">
          {credito(c.pacote.destino.slug)}
        </span>
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
            ou {c.outrasSaidas.map(dataCurta).join(", ")}
          </p>
        )}
        {detalhar && (
          <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {c.precoPorPessoa.map((p, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: prototype
                key={i}
                className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur"
              >
                {pessoaPorExtenso(p)}: {reais(p.preco)}
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

const CARIMBO: Record<EstadoDaProposta, { texto: string; cor: string }> = {
  valida: { texto: "A confirmar", cor: "border-teal-700 text-teal-700" },
  confirmada: {
    texto: "Confirmada",
    cor: "border-emerald-600 text-emerald-600",
  },
  expirada: { texto: "Expirada", cor: "border-stone-500 text-stone-500" },
  erro: { texto: "Não confirmada", cor: "border-red-600 text-red-600" },
  descartada: { texto: "Descartada", cor: "border-stone-500 text-stone-500" },
};

function Bilhete({
  proposta,
  estado,
  aoConfirmar,
  aoDescartar,
}: {
  proposta: Proposta;
  estado: EstadoDaProposta;
  aoConfirmar(): void;
  aoDescartar(): void;
}) {
  const c = proposta.cotacao;
  const { titulo, detalhe } = textoDoEstado(proposta, estado);
  const apagada = estado === "expirada" || estado === "descartada";
  return (
    <article className="relative overflow-hidden rounded-2xl bg-white shadow-md">
      <div
        className={`relative h-24 bg-center bg-cover ${apagada ? "grayscale" : ""}`}
        style={foto(c.pacote.destino.slug)}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <p className="absolute bottom-2 left-4 font-bold text-2xl text-white">
          {c.pacote.destino.nome}
        </p>
        <span className="absolute top-1 right-2 text-[10px] text-white/80">
          {credito(c.pacote.destino.slug)}
        </span>
      </div>
      <span
        className={`-rotate-6 absolute top-28 right-4 rounded border-2 bg-white/80 px-2 py-0.5 font-bold text-xs uppercase tracking-widest ${CARIMBO[estado].cor}`}
      >
        {CARIMBO[estado].texto}
      </span>
      <dl
        className={`grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm ${apagada ? "opacity-50" : ""}`}
      >
        <div className="col-span-2 pr-28">
          <dt className="text-[10px] text-stone-500 uppercase tracking-wide">
            Pacote
          </dt>
          <dd className="font-semibold">{c.pacote.nome}</dd>
          <dd className="text-stone-600">
            {c.pacote.hotel.nome} · {c.pacote.noites} noites
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-stone-500 uppercase tracking-wide">
            Saída
          </dt>
          <dd className="font-semibold">{dataLonga(c.data)}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-stone-500 uppercase tracking-wide">
            Grupo
          </dt>
          <dd className="font-semibold">{grupoPorExtenso(c.grupo)}</dd>
        </div>
      </dl>
      {/* The tear line, with a notch on each side. */}
      <div className="relative border-stone-300 border-t-2 border-dashed">
        <span className="-left-3 -top-3 absolute size-6 rounded-full bg-stone-50" />
        <span className="-right-3 -top-3 absolute size-6 rounded-full bg-stone-50" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] text-stone-500 uppercase tracking-wide">
              {estado === "confirmada" ? "Código da Pré-reserva" : "Total"}
            </p>
            <p className="font-bold font-mono text-2xl tabular-nums">
              {estado === "confirmada"
                ? proposta.preReserva.codigo
                : reais(c.total)}
            </p>
          </div>
          {estado === "confirmada" && (
            <p className="text-right font-semibold tabular-nums">
              {reais(c.total)}
            </p>
          )}
        </div>
        <p
          className={`text-sm ${estado === "erro" ? "text-red-800" : "text-stone-600"}`}
        >
          <span className="sr-only">{titulo}. </span>
          {detalhe}
        </p>
        {estado === "valida" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={aoDescartar}
              className="rounded-xl px-4 py-2.5 font-medium text-stone-600"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={aoConfirmar}
              className="flex-1 rounded-xl bg-teal-700 px-4 py-2.5 font-semibold text-white"
            >
              Confirmar pré-reserva
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function Trilha({ chamadas }: { chamadas: Chamada[] }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setAberta(!aberta)}
        aria-expanded={aberta}
        className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-stone-600 shadow-sm ring-1 ring-stone-200"
      >
        <span className="flex">
          {chamadas.map((ch, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: prototype
              key={i}
              className={`-ml-1 size-3 rounded-full ring-2 ring-white first:ml-0 ${ch.ok ? "bg-teal-600" : "bg-red-500"}`}
            />
          ))}
        </span>
        Como cheguei nessa resposta
        <span aria-hidden>{aberta ? "▴" : "▾"}</span>
      </button>
      {aberta && (
        <ol className="mt-3 ml-3 flex flex-col gap-4 border-stone-300 border-l-2 pl-5">
          {chamadas.map((ch, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: prototype
            <li key={i} className="relative">
              <span
                className={`-left-[27px] absolute top-1 size-3 rounded-full ring-4 ring-stone-50 ${ch.ok ? "bg-teal-600" : "bg-red-500"}`}
              />
              <p className="font-medium">
                {ch.ok ? "Consultei" : "Tentei"} <code>{ch.ferramenta}</code>
              </p>
              <p className={ch.ok ? "text-stone-600" : "text-red-700"}>
                {ch.resumo}
              </p>
              <Json rotulo="Entrada" valor={ch.entrada} />
              <Json rotulo="Saída" valor={ch.saida} />
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
