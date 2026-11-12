import { criarBaseDeConversasEmMemoria } from "./base";
import { testarContratoDaBaseDeConversas } from "./base.contrato";

testarContratoDaBaseDeConversas("memória", async () =>
  criarBaseDeConversasEmMemoria(),
);
