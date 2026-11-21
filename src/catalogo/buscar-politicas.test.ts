import { describe, expect, it } from "vitest";
import {
  conferirIndiceDosTrechos,
  criarBaseDeTrechosEmMemoria,
  criarBaseEmMemoria,
  criarCatalogo,
  relogioFixo,
} from ".";
import { catalogoDeTeste } from "./catalogo-de-teste";
import { buscaNosTextosDeTeste, trechosGravados } from "./textos-de-teste";

const catalogo = criarCatalogo({
  base: criarBaseEmMemoria(catalogoDeTeste),
  ...buscaNosTextosDeTeste(),
  relogio: relogioFixo("2026-12-01T09:00:00-03:00"),
});

describe("buscarPoliticas", () => {
  it('"posso cancelar?" traz o Trecho de cancelamento da Política da Agência entre os primeiros', async () => {
    const resultado = await catalogo.buscarPoliticas({
      pergunta: "posso cancelar?",
    });
    if (!resultado.ok) throw new Error(resultado.mensagem);

    expect(resultado.trechos.slice(0, 2).map((t) => t.id)).toContain(
      "politica-da-agencia#cancelamento",
    );
    expect(
      resultado.trechos.find(
        (t) => t.id === "politica-da-agencia#cancelamento",
      ),
    ).toEqual({
      id: "politica-da-agencia#cancelamento",
      tituloDoDocumento: "Política da Agência",
      secao: "Cancelamento",
      textoCitado: expect.stringMatching(/^Você pode cancelar a viagem/),
    });
  });

  it('"o que diz o Estatuto?" traz primeiro o único Trecho com o nome, que a busca semântica sozinha põe em segundo', async () => {
    const resultado = await catalogo.buscarPoliticas({
      pergunta: "o que diz o Estatuto?",
    });
    if (!resultado.ok) throw new Error(resultado.mensagem);

    expect(resultado.trechos[0].id).toBe(
      "politica-da-agencia#documentos-de-viagem",
    );
  });

  it("devolve sempre os 5 primeiros Trechos, sem nota nem score", async () => {
    const resultado = await catalogo.buscarPoliticas({
      pergunta: "meu cachorro pode ir?",
    });
    if (!resultado.ok) throw new Error(resultado.mensagem);

    expect(resultado.trechos).toHaveLength(5);
    for (const trecho of resultado.trechos) {
      expect(Object.keys(trecho).sort()).toEqual([
        "id",
        "secao",
        "textoCitado",
        "tituloDoDocumento",
      ]);
    }
  });

  it.each([
    { caso: "sem pergunta", entrada: {} },
    { caso: "pergunta vazia", entrada: { pergunta: "   " } },
    { caso: "pergunta que não é texto", entrada: { pergunta: 42 } },
  ])(
    "recusa a entrada inválida ($caso) com ENTRADA_INVALIDA",
    async ({ entrada }) => {
      const resultado = await catalogo.buscarPoliticas(
        entrada as { pergunta: string },
      );

      expect(resultado).toMatchObject({
        ok: false,
        erro: "ENTRADA_INVALIDA",
        mensagem: expect.stringMatching(/pergunta/),
      });
    },
  );

  it("é a ferramenta buscar_politicas, que dá o mesmo resultado da operação direta e avisa que nunca traz preço", async () => {
    const ferramenta = catalogo.ferramentas.find(
      (f) => f.nome === "buscar_politicas",
    );
    const entrada = { pergunta: "posso cancelar?" };

    expect(ferramenta?.descricao).toMatch(/nunca traz preço/i);
    expect(await ferramenta?.executar(entrada)).toEqual(
      await catalogo.buscarPoliticas(entrada),
    );
  });
});

describe("conferirIndiceDosTrechos", () => {
  const { indice, trechos } = trechosGravados();
  const base = criarBaseDeTrechosEmMemoria(indice, trechos);

  it("aceita uma Base indexada com o mesmo modelo e as mesmas dimensões", async () => {
    await expect(
      conferirIndiceDosTrechos(base, {
        modelo: "google:gemini-embedding-2",
        dimensoes: 768,
      }),
    ).resolves.toBeUndefined();
  });

  it("recusa uma Base indexada com outro modelo, dizendo os dois e como resolver", async () => {
    await expect(
      conferirIndiceDosTrechos(base, {
        modelo: "openai:text-embedding-3-large",
        dimensoes: 768,
      }),
    ).rejects.toThrow(
      /google:gemini-embedding-2.*openai:text-embedding-3-large.*pnpm db:setup/s,
    );
  });

  it("recusa uma Base vazia, mandando rodar o setup", async () => {
    await expect(
      conferirIndiceDosTrechos(criarBaseDeTrechosEmMemoria(indice, []), indice),
    ).rejects.toThrow(/vazia.*pnpm db:setup/s);
  });
});
