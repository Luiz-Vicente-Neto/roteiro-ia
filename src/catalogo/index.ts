// Public interface of the catalog module. Framework-free: nothing from Next or Drizzle.
export {
  type BaseDoCatalogo,
  conferirCatalogo,
  criarBaseEmMemoria,
} from "./base";
export { criarCatalogo } from "./catalogo";
export type { CodigoDeErro, Falha } from "./erros";
export type { Ferramenta, ResultadoDeFerramenta } from "./ferramentas";
export { type Relogio, relogioDoSistema, relogioFixo } from "./relogio";
export { semente } from "./semente";
export type * from "./tipos";
export { vagasDoGrupo } from "./vagas";
