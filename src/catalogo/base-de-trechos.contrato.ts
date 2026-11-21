import { describe, expect, it } from "vitest";
import {
  type BaseDeTrechos,
  ESCOPO_GERAL,
  type EscopoDaBusca,
  type IndiceDosTrechos,
  type TrechoIndexado,
} from "./base-de-trechos";
import { embedarPerguntaGravada, trechosGravados } from "./textos-de-teste";

/** Builds a Base de Trechos holding exactly `trechos`, indexed with `indice`. */
export type CriarBaseDeTrechos = (
  indice: IndiceDosTrechos,
  trechos: TrechoIndexado[],
) => Promise<BaseDeTrechos>;

/**
 * The same cases run against every Base de Trechos implementation. They check
 * properties, never the exact order: implementations may rank differently
 * (docs/adr/0005).
 */
export function testarContratoDaBaseDeTrechos(
  nome: string,
  criarBase: CriarBaseDeTrechos,
) {
  const { indice, trechos } = trechosGravados();

  describe(`Base de Trechos (${nome})`, () => {
    it("informa o modelo e as dimensões com que os vetores foram gravados", async () => {
      const base = await criarBase(indice, trechos);

      expect(await base.lerIndice()).toEqual({
        modelo: "google:gemini-embedding-2",
        dimensoes: 768,
      });
    });

    it("vazia, não informa modelo nenhum", async () => {
      const base = await criarBase(indice, []);

      expect(await base.lerIndice()).toBeUndefined();
      expect(
        await base.buscarPorSentido(trechos[0].vetor, 5, ESCOPO_GERAL),
      ).toEqual([]);
      expect(
        await base.buscarPorPalavras("cancelamento", 5, ESCOPO_GERAL),
      ).toEqual([]);
    });

    it.each([
      {
        pergunta: "posso cancelar?",
        esperado: "politica-da-agencia#cancelamento",
      },
      {
        pergunta: "como posso pagar?",
        esperado: "politica-da-agencia#pagamento",
      },
      {
        pergunta: "preciso de passaporte?",
        esperado: "politica-da-agencia#documentos-de-viagem",
      },
      {
        pergunta: "meu cachorro pode ir?",
        esperado: "politica-da-agencia#pets",
      },
    ])(
      'pela busca semântica, "$pergunta" traz $esperado entre os 2 primeiros',
      async ({ pergunta, esperado }) => {
        const base = await criarBase(indice, trechos);

        const encontrados = await base.buscarPorSentido(
          await embedarPerguntaGravada(pergunta),
          2,
          ESCOPO_GERAL,
        );

        expect(encontrados.map((t) => t.id)).toContain(esperado);
      },
    );

    it("devolve no máximo o limite pedido, cada Trecho com o texto citado e sem o vetor", async () => {
      const base = await criarBase(indice, trechos);

      const encontrados = await base.buscarPorSentido(
        await embedarPerguntaGravada("posso cancelar?"),
        3,
        ESCOPO_GERAL,
      );

      expect(encontrados).toHaveLength(3);
      const cancelamento = trechos.find(
        (t) => t.id === "politica-da-agencia#cancelamento",
      );
      expect(encontrados).toContainEqual({
        id: cancelamento?.id,
        documento: cancelamento?.documento,
        tipoDoDocumento: cancelamento?.tipoDoDocumento,
        secao: cancelamento?.secao,
        textoCitado: cancelamento?.textoCitado,
      });
    });

    it.each([
      {
        termo: "cartorio",
        esperado: "politica-da-agencia#documentos-de-viagem",
      },
      { termo: "QUORUM", esperado: "politica-da-agencia#cancelamento" },
    ])(
      'pela busca por palavras, "$termo" digitado sem acento traz $esperado, o Trecho que o contém',
      async ({ termo, esperado }) => {
        const base = await criarBase(indice, trechos);

        const encontrados = await base.buscarPorPalavras(
          termo,
          5,
          ESCOPO_GERAL,
        );

        expect(encontrados.map((t) => t.id)).toContain(esperado);
      },
    );

    it("pela busca por palavras, uma palavra que nenhum Trecho tem não traz nada", async () => {
      const base = await criarBase(indice, trechos);

      expect(await base.buscarPorPalavras("Noronha", 5, ESCOPO_GERAL)).toEqual(
        [],
      );
    });

    it.each(["não", "até", "é"])(
      'pela busca por palavras, uma palavra vazia como "%s" não traz nada, mesmo com acento',
      async (palavra) => {
        const base = await criarBase(indice, trechos);

        expect(await base.buscarPorPalavras(palavra, 5, ESCOPO_GERAL)).toEqual(
          [],
        );
      },
    );

    it('pela busca por palavras, uma sigla curta como "RG" traz o Trecho que a contém', async () => {
      const base = await criarBase(indice, trechos);

      const encontrados = await base.buscarPorPalavras("RG", 5, ESCOPO_GERAL);

      expect(encontrados.map((t) => t.id)).toContain(
        "politica-da-agencia#documentos-de-viagem",
      );
    });

    it("pela busca por palavras, devolve no máximo o limite pedido, sem o vetor", async () => {
      const base = await criarBase(indice, trechos);

      const encontrados = await base.buscarPorPalavras(
        "pagamento da Pré-reserva",
        1,
        ESCOPO_GERAL,
      );

      expect(encontrados).toHaveLength(1);
      expect(Object.keys(encontrados[0]).sort()).toEqual([
        "documento",
        "id",
        "secao",
        "textoCitado",
        "tipoDoDocumento",
      ]);
    });

    describe("restrita a um escopo", () => {
      // Written from the rule, not from the Bases' code: a Trecho of a Hotel
      // counts only for that Hotel, one of a Destino only for that Destino,
      // and one of neither for every search.
      const noEscopo = (escopo: EscopoDaBusca, id: string) => {
        const trecho = trechos.find((t) => t.id === id);
        if (!trecho) throw new Error(`Trecho ${id} não existe`);
        if (trecho.hotel) return escopo.hoteis.includes(trecho.hotel);
        return !trecho.destino || escopo.destinos.includes(trecho.destino);
      };
      const escopos: { caso: string; escopo: EscopoDaBusca }[] = [
        { caso: "sem Destino nem Hotel", escopo: ESCOPO_GERAL },
        {
          caso: "um Destino e todos os seus Hotéis",
          escopo: {
            destinos: ["bonito"],
            hoteis: ["aguas-cristalinas", "pousada-gruta-azul"],
          },
        },
        {
          caso: "um Destino e um só dos seus Hotéis",
          escopo: {
            destinos: ["porto-de-galinhas"],
            hoteis: ["enseada-resort"],
          },
        },
      ];

      it.each(escopos)(
        "pela busca semântica, um filtro nunca deixa passar Trecho de fora do escopo, nem perde um de dentro ($caso)",
        async ({ escopo }) => {
          const base = await criarBase(indice, trechos);

          const encontrados = await base.buscarPorSentido(
            await embedarPerguntaGravada("posso cancelar?"),
            trechos.length,
            escopo,
          );

          const ids = encontrados.map((t) => t.id);
          expect(ids.filter((id) => !noEscopo(escopo, id))).toEqual([]);
          expect(ids.sort()).toEqual(
            trechos
              .map((t) => t.id)
              .filter((id) => noEscopo(escopo, id))
              .sort(),
          );
        },
      );

      it.each(escopos)(
        "pela busca por palavras, um filtro nunca deixa passar Trecho de fora do escopo ($caso)",
        async ({ escopo }) => {
          const base = await criarBase(indice, trechos);

          const encontrados = await base.buscarPorPalavras(
            "cancelamento pets estacionamento check-in clima reembolso",
            trechos.length,
            escopo,
          );

          expect(encontrados.length).toBeGreaterThan(0);
          expect(
            encontrados.map((t) => t.id).filter((id) => !noEscopo(escopo, id)),
          ).toEqual([]);
        },
      );

      it("pela busca por palavras, acha o nome de um Hotel digitado sem acento, só quando o Hotel está no escopo", async () => {
        const base = await criarBase(indice, trechos);
        const doHotel = { destinos: ["bonito"], hoteis: ["aguas-cristalinas"] };

        const dentro = await base.buscarPorPalavras(
          "aguas cristalinas",
          5,
          doHotel,
        );
        const fora = await base.buscarPorPalavras(
          "aguas cristalinas",
          5,
          ESCOPO_GERAL,
        );

        expect(dentro.map((t) => t.id)).toContain(
          "hotel-aguas-cristalinas#estrutura",
        );
        expect(fora.map((t) => t.hotel)).not.toContain("aguas-cristalinas");
      });

      it("devolve o Destino e o Hotel de cada Trecho encontrado", async () => {
        const base = await criarBase(indice, trechos);

        const [encontrado] = await base.buscarPorPalavras("estacionamento", 1, {
          destinos: ["gramado"],
          hoteis: ["serra-azul"],
        });

        expect(encontrado).toMatchObject({
          id: "hotel-serra-azul#estacionamento",
          destino: "gramado",
          hotel: "serra-azul",
        });
      });
    });

    it("recusa um Trecho cujo vetor não tem as dimensões do índice", async () => {
      await expect(
        criarBase(indice, [{ ...trechos[0], vetor: [0.1, 0.2, 0.3] }]),
      ).rejects.toThrow(/dimens/);
    });
  });
}
