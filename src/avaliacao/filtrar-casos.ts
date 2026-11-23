import type { Casos, Categoria } from "./caso";

/** Every category, in the order the Relatório lists them: the Record fails to compile when one is missing. */
const CATEGORIAS = Object.keys({
  preco: true,
  citacao: true,
  injection: true,
  "nao-sei": true,
  "fora-do-escopo": true,
} satisfies Record<Categoria, true>);

/**
 * Only the Casos of `categoria` and/or the one Caso with id `caso`, at the
 * same instant (`pnpm avaliacao --categoria <c> --caso <id>`). Throws on a
 * category or Caso that does not exist, or a pair that matches nothing, so
 * a typo never runs an empty Avaliação.
 */
export function filtrarCasos(
  casos: Casos,
  filtro: { categoria?: string; caso?: string },
): Casos {
  const { categoria, caso } = filtro;
  if (categoria !== undefined && !CATEGORIAS.includes(categoria)) {
    throw new Error(
      `Categoria desconhecida: ${categoria}. As categorias são ${CATEGORIAS.join(", ")}.`,
    );
  }
  if (caso !== undefined && !casos.lista.some((c) => c.id === caso)) {
    throw new Error(`Caso desconhecido: ${caso}.`);
  }
  const lista = casos.lista.filter(
    (c) =>
      (categoria === undefined || c.categoria === categoria) &&
      (caso === undefined || c.id === caso),
  );
  if (lista.length === 0) {
    throw new Error(
      caso === undefined
        ? `Nenhum Caso da categoria ${categoria}.`
        : `O Caso ${caso} não é da categoria ${categoria}: nenhum Caso para rodar.`,
    );
  }
  return { agora: casos.agora, lista };
}
