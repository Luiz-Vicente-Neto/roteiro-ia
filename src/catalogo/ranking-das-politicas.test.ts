import { describe, expect, it } from "vitest";
import { criarBaseEmMemoria, criarCatalogo, relogioFixo, semente } from ".";
import { buscaNosTextosDeTeste } from "./textos-de-teste";

const relogio = relogioFixo("2026-12-01T09:00:00-03:00");
const catalogo = criarCatalogo({
  base: criarBaseEmMemoria(semente),
  ...buscaNosTextosDeTeste(),
  relogio,
});

const ids = (trechos: { id: string }[]) => trechos.map((t) => t.id);
/** The Documento ids of Gramado's Hotéis, e.g. `hotel-<slug>`. */
const gramado = semente.hoteis
  .filter((h) => h.destino === "gramado")
  .map((h) => `hotel-${h.slug}`);

describe("rankingDasPoliticas", () => {
  it("mostra as duas buscas e a fusão, cuja cabeça é o que buscar_politicas devolve", async () => {
    const entrada = {
      pergunta: "posso levar meu cachorro?",
      pacote: "bonito-pousada-gruta-azul-4n",
    };
    const ranking = await catalogo.rankingDasPoliticas(entrada);
    const busca = await catalogo.buscarPoliticas(entrada);
    if (!ranking.ok || !busca.ok) throw new Error("recusou");
    if (!ranking.porSentido.ok) throw new Error(ranking.porSentido.motivo);

    expect(ids(ranking.porSentido.trechos).length).toBeGreaterThan(5);
    expect(ids(ranking.porSentido.trechos)).toContain(
      "hotel-pousada-gruta-azul#pets",
    );
    expect(ids(ranking.fundidos ?? []).slice(0, 5)).toEqual(ids(busca.trechos));
    expect(ranking.devolvidos).toBe(5);
  });

  it("limita a busca pelo Destino como buscar_politicas", async () => {
    const ranking = await catalogo.rankingDasPoliticas({
      pergunta: "Neva em Gramado?",
      destino: "gramado",
    });
    if (!ranking.ok || !ranking.porSentido.ok) throw new Error("recusou");

    expect(ids(ranking.porSentido.trechos)).toContain(
      "faq-gramado#neva-em-gramado",
    );
    const foraDeGramado = (id: string) =>
      /^(destino|faq|hotel)-/.test(id) &&
      !/^(destino-gramado|faq-gramado|faq-geral)#/.test(id) &&
      !gramado.includes(id.slice(0, id.indexOf("#")));
    expect(ids(ranking.porPalavras)).toContain("faq-gramado#neva-em-gramado");
    expect(ids(ranking.porSentido.trechos).filter(foraDeGramado)).toEqual([]);
    expect(ids(ranking.porPalavras).filter(foraDeGramado)).toEqual([]);
  });

  it("recusa um Pacote desconhecido com o mesmo erro e as mesmas sugestões de buscar_politicas", async () => {
    const entrada = { pergunta: "oi", pacote: "bonito-gruta-azul-4n" };

    expect(await catalogo.rankingDasPoliticas(entrada)).toEqual(
      await catalogo.buscarPoliticas(entrada),
    );
  });

  it("sem conseguir embedar a pergunta, ainda mostra a busca por palavras e diz por que a por sentido ficou de fora", async () => {
    const semEmbedding = criarCatalogo({
      base: criarBaseEmMemoria(semente),
      ...buscaNosTextosDeTeste(),
      embedarPergunta: async () => {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY ausente");
      },
      relogio,
    });

    const ranking = await semEmbedding.rankingDasPoliticas({
      pergunta: "posso cancelar?",
    });
    if (!ranking.ok) throw new Error(ranking.mensagem);

    expect(ranking.porSentido).toEqual({
      ok: false,
      motivo: "GOOGLE_GENERATIVE_AI_API_KEY ausente",
    });
    expect(ids(ranking.porPalavras)).toContain(
      "politica-da-agencia#cancelamento",
    );
    expect(ranking.fundidos).toBeUndefined();
  });
});
