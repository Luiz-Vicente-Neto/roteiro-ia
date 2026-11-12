"use client";

// PROTOTYPE, variant C: no bubble. One sheet per answer with dense comparable
// rows that expand, the Proposta as a receipt, the panel as a terminal log.
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

export const NOME_C = "Lista densa";

export function RespostaC({
  resposta,
  estado,
  aoConfirmar,
  aoDescartar,
}: PropsDaResposta) {
  // A lone Cotação (consultar_preco) starts open.
  const [aberta, setAberta] = useState<string | null>(
    resposta.detalhar ? (resposta.cotacoes[0]?.pacote.slug ?? null) : null,
  );
  const destinos = [
    ...new Set(resposta.cotacoes.map((c) => c.pacote.destino.slug)),
  ];
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
      <p className="whitespace-pre-wrap px-4 py-3">{resposta.texto}</p>
      {resposta.cotacoes.length > 0 && (
        <>
          <ul className="divide-y divide-stone-200 border-stone-200 border-t">
            {resposta.cotacoes.map((c) => (
              <Linha
                key={c.pacote.slug + c.data}
                cotacao={c}
                aberta={aberta === c.pacote.slug}
                aoAlternar={() =>
                  setAberta(aberta === c.pacote.slug ? null : c.pacote.slug)
                }
              />
            ))}
          </ul>
          <p className="border-stone-200 border-t px-4 py-1.5 text-[11px] text-stone-500">
            {destinos.map(credito).join(" · ")}
          </p>
        </>
      )}
      {resposta.proposta && (
        <Recibo
          proposta={resposta.proposta}
          estado={estado}
          aoConfirmar={aoConfirmar}
          aoDescartar={aoDescartar}
        />
      )}
      <Registro chamadas={resposta.chamadas} />
    </section>
  );
}

function Linha({
  cotacao: c,
  aberta,
  aoAlternar,
}: {
  cotacao: Cotacao;
  aberta: boolean;
  aoAlternar(): void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberta}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className="size-14 shrink-0 rounded-lg bg-center bg-cover"
          style={foto(c.pacote.destino.slug)}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{c.pacote.nome}</span>
          <span className="block truncate text-sm text-stone-600">
            {c.pacote.hotel.nome}
          </span>
          <span className="block text-stone-500 text-xs">
            {c.pacote.noites} noites · Saída {dataCurta(c.data)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-semibold tabular-nums">
            {reais(c.total)}
          </span>
          <span
            className={`block text-xs ${
              poucasVagas(c.vagasRestantes)
                ? "font-medium text-amber-700"
                : "text-stone-500"
            }`}
          >
            {vagasPorExtenso(c.vagasRestantes)}
          </span>
        </span>
        <span aria-hidden className="text-stone-400">
          {aberta ? "▴" : "▾"}
        </span>
      </button>
      {aberta && (
        <div className="grid gap-x-6 gap-y-3 bg-stone-50 px-4 py-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-stone-500 text-xs">Saída</p>
            <p>{dataLonga(c.data)}</p>
            {c.outrasSaidas && c.outrasSaidas.length > 0 && (
              <p className="text-stone-500 text-xs">
                Também em {c.outrasSaidas.map(dataCurta).join(", ")}
              </p>
            )}
          </div>
          <div>
            <p className="text-stone-500 text-xs">
              Preço por pessoa · {periodoPorExtenso(c)}
            </p>
            {c.precoPorPessoa.map((p, i) => (
              <p
                // biome-ignore lint/suspicious/noArrayIndexKey: prototype
                key={i}
                className="flex justify-between gap-3"
              >
                <span>{pessoaPorExtenso(p)}</span>
                <span className="tabular-nums">{reais(p.preco)}</span>
              </p>
            ))}
          </div>
          <div className="sm:col-span-2">
            <p className="text-stone-500 text-xs">Inclui</p>
            <p>{c.pacote.inclui.join(" · ")}</p>
          </div>
        </div>
      )}
    </li>
  );
}

const SINAL: Record<EstadoDaProposta, { icone: string; cor: string }> = {
  valida: { icone: "●", cor: "text-teal-700" },
  confirmada: { icone: "✔", cor: "text-emerald-700" },
  expirada: { icone: "○", cor: "text-stone-500" },
  erro: { icone: "✕", cor: "text-red-700" },
  descartada: { icone: "○", cor: "text-stone-500" },
};

function Recibo({
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
  const linhas: Array<[string, string]> = [
    ["Pacote", `${c.pacote.nome}, ${c.pacote.noites} noites`],
    ["Hotel", c.pacote.hotel.nome],
    ["Saída", dataLonga(c.data)],
    ["Grupo", grupoPorExtenso(c.grupo)],
  ];
  if (estado === "confirmada") {
    linhas.push(["Código", proposta.preReserva.codigo]);
  }
  return (
    <div className="border-stone-200 border-t bg-stone-50 px-4 py-3">
      <p className={`font-semibold text-sm ${SINAL[estado].cor}`}>
        <span aria-hidden>{SINAL[estado].icone}</span> {titulo}
      </p>
      <dl
        className={`mt-2 font-mono text-[13px] ${apagada ? "line-through opacity-50" : ""}`}
      >
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex items-baseline gap-2 py-0.5">
            <dt className="shrink-0 text-stone-500">{rotulo}</dt>
            <span className="min-w-4 flex-1 border-stone-300 border-b border-dotted" />
            <dd className="text-right">{valor}</dd>
          </div>
        ))}
        <div className="mt-1 flex items-baseline gap-2 border-stone-300 border-t pt-1 font-bold text-base">
          <dt className="shrink-0">Total</dt>
          <span className="flex-1" />
          <dd className="tabular-nums">{reais(c.total)}</dd>
        </div>
      </dl>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p
          className={`min-w-48 flex-1 text-xs ${estado === "erro" ? "text-red-800" : "text-stone-600"}`}
        >
          {detalhe}
        </p>
        {estado === "valida" && (
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={aoDescartar}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={aoConfirmar}
              className="rounded-md bg-teal-700 px-3 py-1.5 font-medium text-white"
            >
              Confirmar pré-reserva
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Registro({ chamadas }: { chamadas: Chamada[] }) {
  const [aberto, setAberto] = useState(false);
  const [chamada, setChamada] = useState<number | null>(null);
  return (
    <div className="border-stone-200 border-t">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between px-4 py-2 text-stone-500 text-xs"
      >
        <span>Como cheguei nessa resposta</span>
        <span>
          {chamadas.length} {chamadas.length === 1 ? "consulta" : "consultas"}{" "}
          {aberto ? "▴" : "▾"}
        </span>
      </button>
      {aberto && (
        <ol className="bg-stone-900 py-2 font-mono text-stone-100 text-xs">
          {chamadas.map((ch, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: prototype
            <li key={i}>
              <button
                type="button"
                onClick={() => setChamada(chamada === i ? null : i)}
                aria-expanded={chamada === i}
                className="flex w-full flex-wrap gap-x-3 px-4 py-1 text-left hover:bg-stone-800"
              >
                <span className="text-stone-500">{i + 1}</span>
                <span className="text-teal-300">{ch.ferramenta}</span>
                <span className={ch.ok ? "text-stone-300" : "text-red-400"}>
                  {ch.ok ? "✓" : "✕"} {ch.resumo}
                </span>
              </button>
              {chamada === i && (
                <div className="grid gap-2 px-4 pb-2 sm:grid-cols-2">
                  <Json rotulo="entrada" valor={ch.entrada} />
                  <Json rotulo="saída" valor={ch.saida} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Json({ rotulo, valor }: { rotulo: string; valor: unknown }) {
  return (
    <div className="min-w-0">
      <p className="text-stone-500">{rotulo}</p>
      <pre className="max-h-64 overflow-auto rounded bg-black/40 p-2 text-[11px]">
        {JSON.stringify(valor, null, 2)}
      </pre>
    </div>
  );
}
