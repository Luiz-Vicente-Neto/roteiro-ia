// Reciprocal Rank Fusion: the hybrid search's two lists become one
// (docs/adr/0005). It reads only positions, never scores, so a cosine and a
// ts_rank combine without being made comparable, and both Bases fuse alike.

/** The usual RRF constant: it keeps the first places of one list from drowning the other. */
const K = 60;

/**
 * One list from several rankings of the same kind of item, best first: each
 * item scores 1 / (K + position) in every list it appears in. Ties keep the
 * order in which the items were first seen.
 */
export function fundirPorPosicao<T extends { id: string }>(listas: T[][]): T[] {
  const fundidos = new Map<string, { item: T; nota: number }>();
  for (const lista of listas) {
    lista.forEach((item, indice) => {
      const nota = 1 / (K + indice + 1);
      const visto = fundidos.get(item.id);
      if (visto) visto.nota += nota;
      else fundidos.set(item.id, { item, nota });
    });
  }
  return [...fundidos.values()]
    .sort((a, b) => b.nota - a.nota)
    .map(({ item }) => item);
}
