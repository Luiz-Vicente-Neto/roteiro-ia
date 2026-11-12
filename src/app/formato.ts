// How the screen writes the catalog's values. It never computes a price or a Vaga.
import type { Chamada, CotacaoDoCard } from "@/assistente/resposta";
import type { Cotacao } from "@/catalogo";

const REAIS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
});
const REAIS_COM_CENTAVOS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Centavos as reais, with centavos only when there are any: 400000 is "R$ 4.000". */
export function reais(centavos: number): string {
  const formato = centavos % 100 === 0 ? REAIS : REAIS_COM_CENTAVOS;
  return formato.format(centavos / 100);
}

// A Saída is a calendar date: formatting it in UTC keeps the day as written.
const DATA_LONGA = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const DATA_CURTA = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** `2027-01-09` as "sáb., 9 de jan. de 2027". */
export function dataLonga(data: string): string {
  return DATA_LONGA.format(new Date(`${data}T00:00:00Z`));
}

/** `2027-01-16` as "16 de jan.". */
export function dataCurta(data: string): string {
  return DATA_CURTA.format(new Date(`${data}T00:00:00Z`));
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export function grupoPorExtenso(grupo: Cotacao["grupo"]): string {
  const adultos = plural(grupo.adultos, "adulto", "adultos");
  if (grupo.criancas.length === 0) return adultos;
  const idades = grupo.criancas.map((i) => plural(i, "ano", "anos"));
  return `${adultos} e ${plural(grupo.criancas.length, "criança", "crianças")} (${idades.join(", ")})`;
}

export function vagasPorExtenso(vagas: number): string {
  return plural(vagas, "Vaga restante", "Vagas restantes");
}

/** Few enough Vagas left to warn the Viajante. */
export function poucasVagas(vagas: number): boolean {
  return vagas <= 3;
}

type Pessoa = CotacaoDoCard["precoPorPessoa"][number];

function pessoaPorExtenso(p: Pessoa): string {
  if (p.pessoa === "crianca") {
    return `Criança de ${plural(p.idade, "ano", "anos")} (${p.percentual}%)`;
  }
  return "idade" in p ? `${p.idade} anos, como adulto` : "Adulto";
}

/**
 * The price of each person, one line per kind of person: "2 adultos:
 * R$ 2.012 cada" rather than the same adult twice.
 */
export function precosPorPessoa({ precoPorPessoa }: CotacaoDoCard): string[] {
  // Same description means same price: both come from the same faixa.
  const grupos = new Map<string, { vezes: number; preco: number }>();
  for (const p of precoPorPessoa) {
    const nome = pessoaPorExtenso(p);
    const grupo = grupos.get(nome);
    if (grupo) grupo.vezes++;
    else grupos.set(nome, { vezes: 1, preco: p.preco });
  }
  return [...grupos].map(([nome, { vezes, preco }]) => {
    if (vezes === 1) return `${nome}: ${reais(preco)}`;
    const quem = nome === "Adulto" ? `${vezes} adultos` : `${vezes} × ${nome}`;
    return `${quem}: ${reais(preco)} cada`;
  });
}

export function periodoPorExtenso({
  periodoAplicado,
  fator,
}: CotacaoDoCard): string {
  if (periodoAplicado === "baixa temporada") return "Baixa temporada";
  return `${periodoAplicado.nome} (×${fator.toLocaleString("pt-BR")})`;
}

/** One line about a tool call, readable without opening the JSON. */
export function resumoDaChamada({ ferramenta, ok, saida }: Chamada): string {
  if (!ok) {
    const falha = saida as { erro?: string; mensagem?: string } | string;
    return typeof falha === "string"
      ? falha
      : `${falha.erro ?? "Erro"}: ${falha.mensagem ?? ""}`;
  }
  const r = saida as Record<string, unknown>;
  switch (ferramenta) {
    case "buscar_pacotes": {
      const n = (r.cotacoes as unknown[]).length;
      return n === 0
        ? "Nenhuma Saída serviu"
        : plural(n, "Cotação encontrada", "Cotações encontradas");
    }
    case "consultar_preco":
      return `Total de ${reais(r.total as number)}`;
    case "verificar_disponibilidade":
      return vagasPorExtenso(r.vagasRestantes as number);
    case "propor_pre_reserva":
      return "Proposta preparada, aguardando confirmação";
    default:
      return "Concluída";
  }
}
