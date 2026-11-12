// Regra de preço: pure domain logic, never SQL (docs/adr/0001).
import type { Grupo } from "./entradas";
import type { DadosDoCatalogo, Pacote, PeriodoTarifario, Saida } from "./tipos";

/**
 * `centavos × fator`, rounded to whole reais (half up) and given back in
 * centavos. Fatores have two decimals, so the product is computed on
 * integers: R$ 30 × 1.15 = R$ 34.50 must give R$ 35, not the R$ 34 a
 * float product (3449.9999…) would.
 */
function emReaisInteiros(centavos: number, fator: number): number {
  const fatorEmCentesimos = Math.round(fator * 100);
  return Math.round((centavos * fatorEmCentesimos) / 10_000) * 100;
}

/** Builds the Cotação of `saida` for `grupo`. */
export function cotar(
  catalogo: DadosDoCatalogo,
  pacote: Pacote,
  saida: Saida,
  grupo: Grupo,
) {
  const hotel = catalogo.hoteis.find((h) => h.slug === pacote.hotel);
  const destino = catalogo.destinos.find((d) => d.slug === hotel?.destino);
  if (!hotel || !destino) {
    // The schema's foreign keys make this impossible; reaching it is a bug.
    throw new Error(`Pacote ${pacote.slug} sem Hotel ou Destino no catálogo`);
  }
  // The Saída's start date prices the whole trip, never night by night.
  const cobrem = catalogo.periodos.filter(
    (p) =>
      p.inicio <= saida.data &&
      saida.data <= p.fim &&
      (p.tipo === "feriado" || p.destino === destino.slug),
  );
  // The biggest fator wins, never stacked; a tie goes to the first in catalog order.
  const periodo = cobrem.reduce<PeriodoTarifario | undefined>(
    (maior, p) => (!maior || p.fator > maior.fator ? p : maior),
    undefined,
  );
  const fator = periodo?.fator ?? 1;
  const precoDeAdulto = emReaisInteiros(pacote.precoBase, fator);
  const precoPorPessoa = Array.from({ length: grupo.adultos }, () => ({
    pessoa: "adulto" as const,
    preco: precoDeAdulto,
  }));
  return {
    ok: true as const,
    pacote: {
      slug: pacote.slug,
      nome: pacote.nome,
      destino: { slug: destino.slug, nome: destino.nome },
      hotel: { slug: hotel.slug, nome: hotel.nome },
      noites: pacote.noites,
      inclui: pacote.inclui,
    },
    data: saida.data,
    grupo,
    precoBase: pacote.precoBase,
    periodoAplicado: periodo ?? ("baixa temporada" as const),
    fator,
    periodosQuePerderam: cobrem.filter((p) => p !== periodo),
    precoPorPessoa,
    total: precoPorPessoa.reduce((soma, p) => soma + p.preco, 0),
    // Equal to the total until Pré-reservas exist (#9) and are subtracted.
    vagasRestantes: saida.vagasTotais,
  };
}
