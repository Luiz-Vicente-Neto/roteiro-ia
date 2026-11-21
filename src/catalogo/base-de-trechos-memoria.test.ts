import { criarBaseDeTrechosEmMemoria } from "./base-de-trechos";
import { testarContratoDaBaseDeTrechos } from "./base-de-trechos.contrato";

testarContratoDaBaseDeTrechos("memória", async (indice, trechos) =>
  criarBaseDeTrechosEmMemoria(indice, trechos),
);
