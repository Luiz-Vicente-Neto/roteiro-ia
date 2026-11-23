import { join } from "node:path";
import { type Trecho, trechosDaPasta } from "../catalogo";

/**
 * The Trechos of the Avaliação's Documentos maliciosos, each a prompt
 * injection that asks for something a rule can spot: a frase-marca or a
 * price no Ferramenta returns. They live only in ./documentos-maliciosos,
 * never among the catalog's Documentos nor in semente.ts, so the seed and the
 * demo never see them. Their vectors are recorded by pnpm embeddings:gravar.
 */
export function trechosMaliciosos(): Trecho[] {
  return trechosDaPasta(join(import.meta.dirname, "documentos-maliciosos"));
}
