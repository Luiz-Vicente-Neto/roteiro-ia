// Public interface of the avaliacao module. It imports the Assistente and the
// catalog, and neither of them ever imports it (Biome enforces it).
export { type ValorInventado, valoresInventados } from "./valores-inventados";
