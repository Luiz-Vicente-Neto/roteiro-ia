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
  semAcento,
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
 * Documentos maliciosos, and ask for its marca. No Trecho of the catalog
 * may have a word of a "não sei" Caso's assunto. No model and no embedding.
 */
export async function conferirCasos(casos: Casos): Promise<string[]> {
  const { modelo, dimensoes } = lerVetoresGravados();
  const { novoCatalogo } = await fabricaDeCatalogos({
    embeddings: {
      indice: { modelo, dimensoes },
      embedarPergunta: async () => {
        throw new Error("conferir os Casos nunca busca nos textos");
      },
    },
    relogio: relogioFixo(casos.agora),
  });
  const catalogo = novoCatalogo();
  const trechos = trechosDosDocumentos();
  const trechosDoCatalogo = new Set(trechos.map((t) => t.id));
  const maliciosos = trechosMaliciosos();
  const problemas: string[] = [];
  const vistos = new Set<string>();
  for (const caso of casos.lista) {
    if (vistos.has(caso.id)) problemas.push(`${caso.id}: id repetido`);
    vistos.add(caso.id);
    const doCaso = await problemasDoCaso(caso, {
      catalogo,
      trechos,
      trechosDoCatalogo,
      maliciosos,
    });
    problemas.push(...doCaso.map((p) => `${caso.id}: ${p}`));
  }
  return problemas;
}

async function problemasDoCaso(
  caso: Caso,
  contexto: {
    catalogo: Catalogo;
    trechos: Trecho[];
    trechosDoCatalogo: Set<string>;
    maliciosos: Trecho[];
  },
): Promise<string[]> {
  switch (caso.categoria) {
    case "preco":
      return problemasDoPreco(caso, contexto.catalogo);
    case "citacao":
      return problemasDaCitacao(caso, contexto.trechosDoCatalogo);
    case "injection":
      return problemasDaInjection(caso, contexto.maliciosos);
    case "nao-sei":
      return problemasDoNaoSei(caso, contexto.trechos);
    case "fora-do-escopo":
      return [];
  }
}

/**
 * A Trecho with a word of the assunto may answer the message, so "não sei"
 * would no longer be the right answer. The first such Trecho per word.
 */
function problemasDoNaoSei(
  { assunto }: CasoDe<"nao-sei">,
  trechos: Trecho[],
): string[] {
  if (assunto.length === 0) return ["nenhuma palavra do assunto"];
  return assunto.flatMap((palavra) => {
    const trecho = trechos.find((t) =>
      semAcento(t.textoCitado).includes(semAcento(palavra)),
    );
    return trecho ? [`“${palavra}” aparece no Trecho ${trecho.id}`] : [];
  });
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
