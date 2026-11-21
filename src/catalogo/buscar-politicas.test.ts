import { describe, expect, it } from "vitest";
import {
  conferirIndiceDosTrechos,
  criarBaseDeTrechosEmMemoria,
  criarBaseEmMemoria,
  criarCatalogo,
  relogioFixo,
  semente,
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

  it("sem conseguir embedar a pergunta, recusa com BUSCA_INDISPONIVEL em vez de buscar só por palavras", async () => {
    const semEmbedding = criarCatalogo({
      base: criarBaseEmMemoria(catalogoDeTeste),
      ...buscaNosTextosDeTeste(),
      embedarPergunta: async () => {
        throw new Error("429 Too Many Requests");
      },
      relogio: relogioFixo("2026-12-01T09:00:00-03:00"),
    });

    const resultado = await semEmbedding.buscarPoliticas({
      pergunta: "posso cancelar?",
    });

    expect(resultado).toEqual({
      ok: false,
      erro: "BUSCA_INDISPONIVEL",
      mensagem:
        "Não consegui consultar as políticas agora, tente de novo em instantes.",
    });
  });
});

describe("buscarPoliticas por Destino e por Pacote", () => {
  const doCatalogo = criarCatalogo({
    base: criarBaseEmMemoria(semente),
    ...buscaNosTextosDeTeste(),
    relogio: relogioFixo("2026-12-01T09:00:00-03:00"),
  });

  async function idsDe(entrada: {
    pergunta: string;
    destino?: string;
    pacote?: string;
  }) {
    const resultado = await doCatalogo.buscarPoliticas(entrada);
    if (!resultado.ok) throw new Error(resultado.mensagem);
    return resultado.trechos.map((t) => t.id);
  }

  it("sem Destino nem Pacote, responde só com a Política da Agência e as FAQs gerais, nunca com a regra de um Hotel qualquer", async () => {
    const ids = await idsDe({ pergunta: "posso levar meu cachorro?" });

    expect(ids).toHaveLength(5);
    expect(
      ids.filter((id) => !/^(politica-da-agencia|faq-geral)#/.test(id)),
    ).toEqual([]);
  });

  it("uma pergunta igual a uma FAQ geral traz essa FAQ entre os primeiros, sem filtro", async () => {
    const ids = await idsDe({ pergunta: "Dá para parcelar a viagem?" });

    expect(ids.slice(0, 2)).toContain("faq-geral#da-para-parcelar-a-viagem");
  });

  it("a FAQ de um Destino aparece com destino daquele Destino", async () => {
    const ids = await idsDe({
      pergunta: "Neva em Gramado?",
      destino: "Gramado",
    });

    expect(ids.slice(0, 2)).toContain("faq-gramado#neva-em-gramado");
  });

  it("a FAQ de um Destino nunca aparece sem filtro nem com outro Destino", async () => {
    expect(await idsDe({ pergunta: "Neva em Gramado?" })).not.toContain(
      "faq-gramado#neva-em-gramado",
    );
    for (const destino of semente.destinos) {
      const ids = await idsDe({
        pergunta: "Neva em Gramado?",
        destino: destino.slug,
      });

      expect(
        ids.filter(
          (id) =>
            id.startsWith("faq-") &&
            !id.startsWith(`faq-${destino.slug}#`) &&
            !id.startsWith("faq-geral#"),
        ),
        destino.slug,
      ).toEqual([]);
    }
  });

  it.each(["Bonito", "bonito", "BONITO"])(
    '"o que fazer em Bonito?" com destino %s responde a partir da Descrição do Destino',
    async (destino) => {
      const ids = await idsDe({ pergunta: "o que fazer em Bonito?", destino });

      expect(ids.slice(0, 2)).toContain("destino-bonito#o-que-fazer");
    },
  );

  it("com destino, aceita o slug e o nome sem acento, e só traz a Política, as FAQs gerais e o Destino e os Hotéis dele", async () => {
    const doDestino =
      /^(politica-da-agencia|faq-geral|(destino|faq)-foz-do-iguacu|hotel-(cataratas-park|tres-fronteiras|mata-atlantica-resort))#/;

    for (const destino of ["foz-do-iguacu", "foz do iguacu"]) {
      const ids = await idsDe({
        pergunta: "o hotel tem estacionamento?",
        destino,
      });

      expect(
        ids.filter((id) => !doDestino.test(id)),
        destino,
      ).toEqual([]);
      expect(
        ids.some((id) => id.startsWith("hotel-")),
        destino,
      ).toBe(true);
    }
  });

  it('depois de ver um Pacote com pet, "posso levar meu cachorro?" traz a seção de pets do Hotel daquele Pacote, e de nenhum outro Hotel', async () => {
    const ids = await idsDe({
      pergunta: "posso levar meu cachorro?",
      pacote: "bonito-pousada-gruta-azul-4n",
    });

    expect(ids.slice(0, 2)).toContain("hotel-pousada-gruta-azul#pets");
    expect(
      ids.filter(
        (id) =>
          id.startsWith("hotel-") &&
          !id.startsWith("hotel-pousada-gruta-azul#"),
      ),
    ).toEqual([]);
  });

  it('com pacote, "o hotel tem estacionamento?" traz o estacionamento do Hotel do Pacote', async () => {
    const ids = await idsDe({
      pergunta: "o hotel tem estacionamento?",
      pacote: "campos-do-jordao-vila-capivari-3n",
    });

    expect(ids.slice(0, 2)).toContain("hotel-vila-capivari#estacionamento");
  });

  it("a exceção de cancelamento de um Hotel aparece para o Pacote dele", async () => {
    expect(
      await idsDe({
        pergunta: "posso cancelar?",
        pacote: "porto-de-galinhas-enseada-resort-5n",
      }),
    ).toContain("hotel-enseada-resort#cancelamento");
    expect(
      await idsDe({
        pergunta: "posso cancelar?",
        pacote: "campos-do-jordao-chateau-montanha-4n",
      }),
    ).toContain("hotel-chateau-montanha#cancelamento");
  });

  it("a exceção de cancelamento de um Hotel nunca aparece para Pacotes de outros Hotéis", async () => {
    const excecoes = {
      "enseada-resort": "hotel-enseada-resort#cancelamento",
      "chateau-montanha": "hotel-chateau-montanha#cancelamento",
    };
    for (const pacote of semente.pacotes) {
      const ids = await idsDe({
        pergunta: "posso cancelar?",
        pacote: pacote.slug,
      });

      for (const [hotel, excecao] of Object.entries(excecoes)) {
        if (pacote.hotel !== hotel) {
          expect(ids, pacote.slug).not.toContain(excecao);
        }
      }
    }
  });

  it("recusa um Destino desconhecido com DESTINO_DESCONHECIDO, com os Destinos existentes em sugestoes", async () => {
    const resultado = await doCatalogo.buscarPoliticas({
      pergunta: "o que fazer?",
      destino: "Paris",
    });

    expect(resultado).toMatchObject({
      ok: false,
      erro: "DESTINO_DESCONHECIDO",
      mensagem: expect.stringMatching(/Paris/),
    });
    expect(!resultado.ok && resultado.sugestoes).toContain("Bonito");
  });

  it("recusa um Pacote desconhecido com PACOTE_DESCONHECIDO, sugerindo os slugs parecidos", async () => {
    const resultado = await doCatalogo.buscarPoliticas({
      pergunta: "posso levar meu cachorro?",
      pacote: "bonito-gruta-azul-4n",
    });

    expect(resultado).toMatchObject({
      ok: false,
      erro: "PACOTE_DESCONHECIDO",
      mensagem: expect.stringMatching(/bonito-gruta-azul-4n/),
    });
    expect(!resultado.ok && resultado.sugestoes).toContain(
      "bonito-pousada-gruta-azul-4n",
    );
  });

  it.each([
    { caso: "destino vazio", entrada: { pergunta: "oi", destino: " " } },
    { caso: "pacote que não é texto", entrada: { pergunta: "oi", pacote: 7 } },
  ])("recusa $caso com ENTRADA_INVALIDA", async ({ entrada }) => {
    const resultado = await doCatalogo.buscarPoliticas(
      entrada as { pergunta: string },
    );

    expect(resultado).toMatchObject({ ok: false, erro: "ENTRADA_INVALIDA" });
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
