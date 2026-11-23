import { criarLimitadorEmMemoria } from "./limitador";
import { testarContratoDoLimitador } from "./limitador.contrato";

testarContratoDoLimitador("memória", async () => criarLimitadorEmMemoria());
