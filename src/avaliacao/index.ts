// Public interface of the avaliacao module. It imports the Assistente and the
// catalog, and neither of them ever imports it (Biome enforces it).

export {
  avaliar,
  PISO_POR_CATEGORIA,
  type PlacarDaCategoria,
  type Relatorio,
  type ResultadoDoCaso,
  type ResultadosDaAvaliacao,
} from "./avaliar";
export type { Caso, Casos, Categoria } from "./caso";
export { CASOS } from "./casos";
export { resolverRpm } from "./cota";
export { trechosMaliciosos } from "./documentos-maliciosos";
export { filtrarCasos } from "./filtrar-casos";
export { relatorioEmMarkdown } from "./relatorio";
export { resultadosEmArquivo } from "./resultados-em-arquivo";
export { type ValorInventado, valoresInventados } from "./valores-inventados";
