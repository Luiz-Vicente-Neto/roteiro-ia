// Public interface of the catalog module. Framework-free: nothing from Next or Drizzle.
export {
  type BaseDoCatalogo,
  conferirCatalogo,
  criarBaseEmMemoria,
} from "./base";
export {
  type BaseDeTrechos,
  conferirIndiceDosTrechos,
  conferirVetores,
  criarBaseDeTrechosEmMemoria,
  type Embedar,
  ESCOPO_GERAL,
  type EscopoDaBusca,
  type IndiceDosTrechos,
  type TrechoEncontrado,
  type TrechoIndexado,
} from "./base-de-trechos";
export {
  type Catalogo,
  criarCatalogo,
  type NomeDeFerramenta,
  type ResultadoDe,
} from "./catalogo";
export { trechosDosDocumentos } from "./documentos";
export type { CodigoDeErro, Falha } from "./erros";
export type { Ferramenta } from "./ferramentas";
export type { Cotacao } from "./preco";
export { type Relogio, relogioDoSistema, relogioFixo } from "./relogio";
export { semente } from "./semente";
export type * from "./tipos";
export { vagasDoGrupo } from "./vagas";
export {
  baseDosVetoresGravados,
  gravarVetores,
  indexarTrechos,
  lerVetoresGravados,
  PERGUNTAS_GRAVADAS,
  type VetoresGravados,
} from "./vetores-gravados";
