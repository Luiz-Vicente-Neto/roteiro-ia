// PROTOTYPE, variant A: tall stacked cards, photo on top, plain <details> panel.
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

export const NOME_A = "Cards empilhados";

export function RespostaA({
  resposta,
  estado,
  aoConfirmar,
  aoDescartar,
}: PropsDaResposta) {
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[85%] self-start whitespace-pre-wrap rounded-2xl bg-white px-4 py-2 shadow-sm">
        {resposta.texto}
      </p>
      {resposta.cotacoes.map((c) => (
        <CardDeCotacao
          key={c.pacote.slug + c.data}
          cotacao={c}
          detalhar={resposta.detalhar}
        />
      ))}
      {resposta.proposta && (
        <CardDeProposta
          proposta={resposta.proposta}
          estado={estado}
          aoConfirmar={aoConfirmar}
          aoDescartar={aoDescartar}
        />
      )}
      <Painel chamadas={resposta.chamadas} />
    </div>
  );
}

function CardDeCotacao({
  cotacao: c,
  detalhar,
}: {
  cotacao: Cotacao;
  detalhar?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
      <div
        className="relative aspect-[16/9] bg-cover bg-center"
        style={foto(c.pacote.destino.slug)}
      >
        <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-0.5 font-medium text-xs">
          {c.pacote.destino.nome}
        </span>
        <span className="absolute right-0 bottom-0 rounded-tl-lg bg-black/50 px-2 py-0.5 text-[10px] text-white">
          {credito(c.pacote.destino.slug)}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div>
          <h3 className="font-semibold text-lg leading-tight">
            {c.pacote.nome}
          </h3>
          <p className="text-sm text-stone-600">
            {c.pacote.hotel.nome} · {c.pacote.noites} noites
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-stone-500 text-xs">Saída</dt>
            <dd className="font-medium">{dataLonga(c.data)}</dd>
          </div>
          <div>
            <dt className="text-stone-500 text-xs">Grupo</dt>
            <dd className="font-medium">{grupoPorExtenso(c.grupo)}</dd>
          </div>
        </dl>
        {detalhar && (
          <ul className="rounded-lg bg-stone-50 p-3 text-sm">
            {c.precoPorPessoa.map((p, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: prototype
                key={i}
                className="flex justify-between gap-3 py-0.5"
              >
                <span>{pessoaPorExtenso(p)}</span>
                <span className="tabular-nums">{reais(p.preco)}</span>
              </li>
            ))}
            <li className="mt-1 border-stone-200 border-t pt-1 text-stone-500 text-xs">
              {periodoPorExtenso(c)}
            </li>
          </ul>
        )}
        <div className="flex items-end justify-between gap-3 border-stone-200 border-t pt-3">
          <div>
            <p className="text-stone-500 text-xs">Total do Grupo</p>
            <p className="font-bold text-2xl tabular-nums">{reais(c.total)}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 font-medium text-xs ${
              poucasVagas(c.vagasRestantes)
                ? "bg-amber-100 text-amber-900"
                : "bg-stone-100 text-stone-700"
            }`}
          >
            {vagasPorExtenso(c.vagasRestantes)}
          </span>
        </div>
        {c.outrasSaidas && c.outrasSaidas.length > 0 && (
          <p className="text-stone-500 text-xs">
            Também sai em {c.outrasSaidas.map(dataCurta).join(" e ")}
          </p>
        )}
      </div>
    </article>
  );
}

const FAIXA: Record<EstadoDaProposta, string> = {
  valida: "bg-teal-700 text-white",
  confirmada: "bg-emerald-600 text-white",
  expirada: "bg-stone-300 text-stone-700",
  erro: "bg-red-600 text-white",
  descartada: "bg-stone-300 text-stone-700",
};

function CardDeProposta({
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
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
      <header className={`px-4 py-2 font-semibold text-sm ${FAIXA[estado]}`}>
        {titulo}
      </header>
      <div className="flex flex-col gap-3 p-4">
        {estado === "confirmada" && (
          <p className="rounded-lg bg-emerald-50 p-3 text-center">
            <span className="block text-emerald-800 text-xs">
              Código da Pré-reserva
            </span>
            <span className="font-bold font-mono text-2xl tracking-widest">
              {proposta.preReserva.codigo}
            </span>
          </p>
        )}
        <dl
          className={`grid grid-cols-2 gap-x-4 gap-y-2 text-sm ${apagada ? "opacity-50" : ""}`}
        >
          <div className="col-span-2">
            <dt className="text-stone-500 text-xs">Pacote</dt>
            <dd className="font-medium">
              {c.pacote.nome} · {c.pacote.hotel.nome} · {c.pacote.noites} noites
            </dd>
          </div>
          <div>
            <dt className="text-stone-500 text-xs">Saída</dt>
            <dd className="font-medium">{dataLonga(c.data)}</dd>
          </div>
          <div>
            <dt className="text-stone-500 text-xs">Grupo</dt>
            <dd className="font-medium">{grupoPorExtenso(c.grupo)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-stone-500 text-xs">Total</dt>
            <dd className="font-bold text-2xl tabular-nums">
              {reais(c.total)}
            </dd>
          </div>
        </dl>
        <p
          className={`text-sm ${estado === "erro" ? "text-red-800" : "text-stone-600"}`}
        >
          {detalhe}
        </p>
        {estado === "valida" && (
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              onClick={aoConfirmar}
              className="flex-1 rounded-full bg-teal-700 px-5 py-2.5 font-medium text-white"
            >
              Confirmar pré-reserva
            </button>
            <button
              type="button"
              onClick={aoDescartar}
              className="flex-1 rounded-full border border-stone-300 px-5 py-2.5 font-medium text-stone-700"
            >
              Descartar
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function Painel({ chamadas }: { chamadas: Chamada[] }) {
  return (
    <details className="rounded-xl bg-stone-100 text-sm">
      <summary className="cursor-pointer px-4 py-2 text-stone-600">
        Como cheguei nessa resposta ({chamadas.length}{" "}
        {chamadas.length === 1 ? "consulta" : "consultas"})
      </summary>
      <ol className="flex flex-col gap-3 px-4 pb-4">
        {chamadas.map((ch, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: prototype
          <li key={i} className="rounded-lg bg-white p-3">
            <p className="flex items-baseline gap-2">
              <span className="text-stone-400 tabular-nums">{i + 1}.</span>
              <code className="font-medium">{ch.ferramenta}</code>
            </p>
            <p className={ch.ok ? "text-stone-600" : "text-red-700"}>
              {ch.resumo}
            </p>
            <Json rotulo="Entrada" valor={ch.entrada} />
            <Json rotulo="Saída" valor={ch.saida} />
          </li>
        ))}
      </ol>
    </details>
  );
}

function Json({ rotulo, valor }: { rotulo: string; valor: unknown }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-stone-500 text-xs">
        {rotulo}
      </summary>
      <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-stone-900 p-3 text-stone-100 text-xs">
        {JSON.stringify(valor, null, 2)}
      </pre>
    </details>
  );
}
