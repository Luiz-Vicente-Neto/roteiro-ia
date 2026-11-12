import type { Saida } from "./tipos";

/**
 * Vagas still free on `saida`. The single place every operation asks, so
 * subtracting active Pré-reservas (#9) changes all of them at once.
 */
export function vagasRestantes(saida: Saida): number {
  return saida.vagasTotais;
}
