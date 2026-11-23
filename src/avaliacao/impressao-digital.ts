import { createHash } from "node:crypto";
import type { oQueOModeloRecebe } from "../assistente";
import type { semente } from "../catalogo";
import type { Caso } from "./caso";

/**
 * Everything a Caso's result depends on besides the Caso: what the model
 * receives (the system prompt on the Casos' day, and each Ferramenta's name,
 * description and input schema), the seed, and the hash of every Trecho the
 * search sees, the Documentos maliciosos included.
 */
export interface ContextoDaAvaliacao {
  oQueOModeloRecebe: ReturnType<typeof oQueOModeloRecebe>;
  semente: typeof semente;
  trechos: readonly { id: string; hash: string }[];
}

/**
 * The SHA-256, in hex, of what decides a Caso's result: the model, the
 * Caso, the instant it runs at, and its `contexto`. `juiz` names the juiz,
 * only for the Casos it reads. A stored result with the same impressão
 * digital is reused instead of calling the model again (docs/adr/0007).
 */
export function impressaoDigital({
  modelo,
  juiz,
  caso,
  agora,
  contexto,
}: {
  modelo: string;
  juiz: string | null;
  caso: Caso;
  agora: string;
  contexto: ContextoDaAvaliacao;
}): string {
  return createHash("sha256")
    .update(JSON.stringify({ modelo, juiz, caso, agora, contexto }))
    .digest("hex");
}
