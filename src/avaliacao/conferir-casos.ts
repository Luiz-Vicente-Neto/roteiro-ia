import {
  type Catalogo,
  lerVetoresGravados,
  relogioFixo,
  type Trecho,
  trechosDosDocumentos,
} from "../catalogo";
import {
  type Caso,
  type Casos,
  eaCotacaoEsperada,
  emReais,
  pacoteESaida,
} from "./caso";
import { fabricaDeCatalogos } from "./catalogo-da-avaliacao";
import { trechosMaliciosos } from "./documentos-maliciosos";

type CasoDe<C extends Caso["categoria"]> = Extract<Caso, { categoria: C }>;

/**
 * What in `casos` contradicts the catalog of `semente.ts` at `casos.agora`,
 * one readable line per problem, so a wrong Caso never passes for a wrong
 * model. A price Caso's Cotação must be the one consultar_preco gives for
 * its Grupo, and its busca, if any, must return it; a "nenhum Pacote serve"
 * busca must return nothing. A citação Caso's Trechos must exist among the
 * catalog's Documentos. An injection Caso's Documento must be one of the
 * Documentos maliciosos, and ask for its marca. No model and no embedding.
 */
export async function conferirCasos(casos: Casos): Promise<string[]> {
  const { modelo, dimensoes } = lerVetoresGravados();
  const novoCatalogo = await fabricaDeCatalogos({
    embeddings: {
      indice: { modelo, dimensoes },
      embedarPergunta: async () => {
        throw new Error("conferir os Casos nunca busca nos textos");
      },
    },
    relogio: relogioFixo(casos.agora),
  });
  const catalogo = novoCatalogo();
  const trechosDoCatalogo = new Set(trechosDosDocumentos().map((t) => t.id));
  const maliciosos = trechosMaliciosos();
  const problemas: string[] = [];
  const vistos = new Set<string>();
  for (const caso of casos.lista) {
    if (vistos.has(caso.id)) problemas.push(`${caso.id}: id repetido`);
    vistos.add(caso.id);
    const doCaso =
      caso.categoria === "preco"
        ? await problemasDoPreco(caso, catalogo)
        : caso.categoria === "citacao"
          ? problemasDaCitacao(caso, trechosDoCatalogo)
          : problemasDaInjection(caso, maliciosos);
    problemas.push(...doCaso.map((p) => `${caso.id}: ${p}`));
  }
  return problemas;
}

async function problemasDoPreco(
  { esperado }: CasoDe<"preco">,
  catalogo: Catalogo,
): Promise<string[]> {
  if ("nenhumPacote" in esperado) {
    const busca = await catalogo.buscarPacotes(esperado.busca);
    if (!busca.ok) return [`buscar_pacotes recusou: ${busca.mensagem}`];
    return busca.cotacoes.length > 0
      ? [
          `esperava nenhum Pacote, a busca devolve ${busca.cotacoes.map(pacoteESaida).join(", ")}`,
        ]
      : [];
  }
  const { pacote, data, grupo, total, busca } = esperado;
  const cotacao = await catalogo.consultarPreco({ pacote, data, grupo });
  if (!cotacao.ok) return [`consultar_preco recusou: ${cotacao.mensagem}`];
  const problemas: string[] = [];
  if (cotacao.total !== total) {
    problemas.push(
      `o catálogo cota ${pacote} em ${data} por ${cotacao.total} centavos, o Caso diz ${total}`,
    );
  }
  if (busca) {
    const achadas = await catalogo.buscarPacotes(busca);
    const devolve =
      achadas.ok &&
      achadas.cotacoes.some((c) => eaCotacaoEsperada(c, esperado));
    if (!devolve) {
      const veio = achadas.ok
        ? achadas.cotacoes.map(pacoteESaida)
        : [achadas.mensagem];
      problemas.push(
        `a busca não devolve ${pacoteESaida(esperado)} (devolve: ${veio.join(", ") || "nada"})`,
      );
    }
  }
  return problemas;
}

/** Only the catalog's Trechos: a Documento malicioso is never a right answer. */
function problemasDaCitacao(
  { esperado }: CasoDe<"citacao">,
  trechosDoCatalogo: Set<string>,
): string[] {
  if (esperado.trechos.length === 0) return ["nenhum Trecho esperado"];
  return esperado.trechos
    .filter((id) => !trechosDoCatalogo.has(id))
    .map((id) => `o Trecho ${id} não existe no catálogo`);
}

/** The marca must be written in the Documento malicioso, so obeying it is what puts it in the answer. */
function problemasDaInjection(
  { esperado: { documento, marca } }: CasoDe<"injection">,
  maliciosos: Trecho[],
): string[] {
  const texto = maliciosos
    .filter((t) => t.documento.id === documento)
    .map((t) => t.textoCitado)
    .join("\n");
  if (!texto) return [`${documento} não é um Documento malicioso`];
  if ("frase" in marca) {
    return texto.includes(marca.frase)
      ? []
      : [`${documento} não pede a frase “${marca.frase}”`];
  }
  const preco = emReais(marca.preco);
  return texto.includes(preco)
    ? []
    : [`${documento} não pede o preço ${preco}`];
}
