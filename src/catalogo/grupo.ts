// Aceitação do Grupo pela Política de Crianças: pure domain logic (docs/adr/0001).
import type { Grupo } from "./entradas";
import { type Falha, falha } from "./erros";
import type { Pacote } from "./tipos";

/** From this age on, a person counts as an adult. */
export const IDADE_ADULTA = 12;

/** Ages in the Grupo that count as children, in the order given. */
export function idadesDeCriancas(grupo: Grupo): number[] {
  return grupo.criancas.filter((idade) => idade < IDADE_ADULTA);
}

/**
 * The GRUPO_NAO_ACEITO error when `pacote` does not take `grupo`, or
 * undefined when it does. Every operation that receives a Grupo checks it.
 */
export function recusaDoGrupo(
  pacote: Pacote,
  grupo: Grupo,
): Falha<"GRUPO_NAO_ACEITO"> | undefined {
  const criancas = idadesDeCriancas(grupo);
  if (pacote.politicaDeCriancas.aceitaCriancas || criancas.length === 0) {
    return undefined;
  }
  const idades = criancas.map((idade) => `${idade} anos`).join(", ");
  return falha(
    "GRUPO_NAO_ACEITO",
    `O Pacote "${pacote.slug}" não aceita crianças, e o Grupo tem criança de ${idades}. A partir de ${IDADE_ADULTA} anos a pessoa conta como adulto. Explique isso ao viajante e ofereça um Pacote que aceite crianças.`,
  );
}
