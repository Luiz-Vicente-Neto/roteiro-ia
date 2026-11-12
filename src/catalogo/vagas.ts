import type { Grupo } from "./entradas";
import type { DadosDoCatalogo, Saida, VagasOcupadas } from "./tipos";

/** Vagas held by active Pré-reservas, by Saída. */
export type Ocupacao = ReadonlyMap<string, number>;

/** Key of a Saída in an Ocupacao. */
export const chaveDaSaida = (pacote: string, data: string) =>
  `${pacote}\n${data}`;

export function ocupacao(lista: VagasOcupadas[]): Ocupacao {
  return new Map(lista.map((o) => [chaveDaSaida(o.pacote, o.data), o.vagas]));
}

/** The catalog as it stands now: its data plus the Vagas already held. */
export type CatalogoVigente = DadosDoCatalogo & { ocupacao: Ocupacao };

/**
 * Vagas still free on `saida`: the total minus the people of its active
 * Pré-reservas. The single place every operation asks.
 */
export function vagasRestantes(
  { ocupacao }: CatalogoVigente,
  saida: Saida,
): number {
  return (
    saida.vagasTotais -
    (ocupacao.get(chaveDaSaida(saida.pacote, saida.data)) ?? 0)
  );
}

/** Every person takes a Vaga, children included, even when they pay nothing. */
export function vagasDoGrupo(grupo: Grupo): number {
  return grupo.adultos + grupo.criancas.length;
}
