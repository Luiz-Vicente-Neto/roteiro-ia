import { describe, expect, it } from "vitest";
import type {
  BaseDeTrechos,
  IndiceDosTrechos,
  TrechoIndexado,
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
      expect(await base.buscarPorSentido(trechos[0].vetor, 5)).toEqual([]);
      expect(await base.buscarPorPalavras("cancelamento", 5)).toEqual([]);
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
        );

        expect(encontrados.map((t) => t.id)).toContain(esperado);
      },
    );

    it("devolve no máximo o limite pedido, cada Trecho com o texto citado e sem o vetor", async () => {
      const base = await criarBase(indice, trechos);

      const encontrados = await base.buscarPorSentido(
        await embedarPerguntaGravada("posso cancelar?"),
        3,
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

        const encontrados = await base.buscarPorPalavras(termo, 5);

        expect(encontrados.map((t) => t.id)).toContain(esperado);
      },
    );

    it("pela busca por palavras, uma palavra que nenhum Trecho tem não traz nada", async () => {
      const base = await criarBase(indice, trechos);

      expect(await base.buscarPorPalavras("Jericoacoara", 5)).toEqual([]);
    });

    it.each(["não", "até", "é"])(
      'pela busca por palavras, uma palavra vazia como "%s" não traz nada, mesmo com acento',
      async (palavra) => {
        const base = await criarBase(indice, trechos);

        expect(await base.buscarPorPalavras(palavra, 5)).toEqual([]);
      },
    );

    it('pela busca por palavras, uma sigla curta como "RG" traz o Trecho que a contém', async () => {
      const base = await criarBase(indice, trechos);

      const encontrados = await base.buscarPorPalavras("RG", 5);

      expect(encontrados.map((t) => t.id)).toContain(
        "politica-da-agencia#documentos-de-viagem",
      );
    });

    it("pela busca por palavras, devolve no máximo o limite pedido, sem o vetor", async () => {
      const base = await criarBase(indice, trechos);

      const encontrados = await base.buscarPorPalavras(
        "pagamento da Pré-reserva",
        1,
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

    it("recusa um Trecho cujo vetor não tem as dimensões do índice", async () => {
      await expect(
        criarBase(indice, [{ ...trechos[0], vetor: [0.1, 0.2, 0.3] }]),
      ).rejects.toThrow(/dimens/);
    });
  });
}
