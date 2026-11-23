import { lerVetoresGravados, relogioFixo } from "../catalogo";
import { type Casos, eaCotacaoEsperada, pacoteESaida } from "./caso";
import { fabricaDeCatalogos } from "./catalogo-da-avaliacao";

/**
 * What in `casos` contradicts the catalog of `semente.ts` at `casos.agora`,
 * one readable line per problem, so a wrong Caso never passes for a wrong
 * model. A price Caso's Cotação must be the one consultar_preco gives for
 * its Grupo, and its busca, if any, must return it; a "nenhum Pacote serve"
 * busca must return nothing. No model and no embedding.
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
  const problemas: string[] = [];
  const vistos = new Set<string>();
  for (const { id, esperado } of casos.lista) {
    if (vistos.has(id)) problemas.push(`${id}: id repetido`);
    vistos.add(id);
    if ("nenhumPacote" in esperado) {
      const busca = await catalogo.buscarPacotes(esperado.busca);
      if (!busca.ok) {
        problemas.push(`${id}: buscar_pacotes recusou: ${busca.mensagem}`);
      } else if (busca.cotacoes.length > 0) {
        problemas.push(
          `${id}: esperava nenhum Pacote, a busca devolve ${busca.cotacoes.map(pacoteESaida).join(", ")}`,
        );
      }
      continue;
    }
    const { pacote, data, grupo, total, busca } = esperado;
    const cotacao = await catalogo.consultarPreco({ pacote, data, grupo });
    if (!cotacao.ok) {
      problemas.push(`${id}: consultar_preco recusou: ${cotacao.mensagem}`);
      continue;
    }
    if (cotacao.total !== total) {
      problemas.push(
        `${id}: o catálogo cota ${pacote} em ${data} por ${cotacao.total} centavos, o Caso diz ${total}`,
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
          `${id}: a busca não devolve ${pacoteESaida(esperado)} (devolve: ${veio.join(", ") || "nada"})`,
        );
      }
    }
  }
  return problemas;
}
