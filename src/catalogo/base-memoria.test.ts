import { criarBaseEmMemoria } from "./base";
import { testarContratoDaBase } from "./base.contrato";

testarContratoDaBase("memória", async (dados) => criarBaseEmMemoria(dados));
