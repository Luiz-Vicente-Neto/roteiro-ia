import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import {
  passoDeChamada,
  passoDeTexto,
  type RespostaRoteirizada,
} from "../assistente/modelo-de-teste";
import { lerVetoresGravados, relogioFixo } from "../catalogo";
import { avaliar, type ResultadoDoCaso } from ".";
import type { Caso } from "./caso";

// In the seed at this instant: gramado-serra-azul-3n on 2027-07-10 for a
// couple is R$ 5.780,00 (Inverno na Serra), on 2027-07-17 R$ 5.780,00 too,
// and on 2027-03-13 R$ 4.282,00 (baixa temporada).
const AGORA = "2026-12-01T09:00:00-03:00";
const vetoresGravados = lerVetoresGravados();
/** The model of the recorded vectors, as the real embedding must be. */
const INDICE_GRAVADO = {
  modelo: vetoresGravados.modelo,
  dimensoes: vetoresGravados.dimensoes,
};
const casal = { adultos: 2, criancas: [] };

const gramadoEmJulho: Caso = {
  id: "preco-gramado-julho",
  categoria: "preco",
  mensagem:
    "Quanto custa o Gramado Essencial no Serra Azul saindo em 10/07/2027 para 2 adultos?",
  esperado: {
    pacote: "gramado-serra-azul-3n",
    data: "2027-07-10",
    grupo: casal,
    total: 578000,
  },
};

/** consultar_preco of gramado-serra-azul-3n on `data` for a couple. */
function cotarGramado(data: string): RespostaRoteirizada {
  return passoDeChamada("consultar_preco", {
    pacote: "gramado-serra-azul-3n",
    data,
    grupo: casal,
  });
}

/**
 * Runs `avaliar` with a fake model scripted per Caso id, recording the
 * results and never waiting.
 */
async function avaliarComRoteiro(
  roteiros: Record<string, RespostaRoteirizada[]>,
  casos: Caso[] = [gramadoEmJulho],
) {
  const gravados: ResultadoDoCaso[] = [];
  const relatorio = await avaliar({
    casos: { agora: AGORA, lista: casos },
    modelo: {
      nome: "falso:roteirizado",
      para: (caso) =>
        new MockLanguageModelV4({ doStream: roteiros[caso.id] ?? [] }),
    },
    embeddings: {
      indice: INDICE_GRAVADO,
      embedarPergunta: async (texto) => {
        throw new Error(`nenhum teste de avaliar embeda perguntas: ${texto}`);
      },
    },
    resultados: {
      gravar: async (resultado) => {
        gravados.push(resultado);
      },
    },
    esperar: async () => {},
    relogio: relogioFixo("2026-11-23T10:00:00-03:00"),
  });
  return { relatorio, gravados };
}

describe("avaliar", () => {
  it("aprova um Caso de preço cuja Cotação está entre os cards", async () => {
    const { relatorio } = await avaliarComRoteiro({
      [gramadoEmJulho.id]: [
        cotarGramado("2027-07-10"),
        passoDeTexto("Veja a Cotação no card."),
      ],
    });

    expect(relatorio.aprovada).toBe(true);
    expect(relatorio.categorias).toEqual([
      {
        categoria: "preco",
        acertos: 1,
        total: 1,
        percentual: 100,
        piso: 80,
        aprovada: true,
      },
    ]);
    expect(relatorio.reprovados).toEqual([]);
  });
  it("reprova um Caso cujos cards trazem outra Cotação, dizendo qual esperava e quais vieram", async () => {
    const { relatorio } = await avaliarComRoteiro({
      [gramadoEmJulho.id]: [
        cotarGramado("2027-07-17"),
        cotarGramado("2027-03-13"),
        passoDeTexto("Veja as Cotações nos cards."),
      ],
    });

    expect(relatorio.aprovada).toBe(false);
    expect(relatorio.reprovados).toEqual([
      {
        caso: "preco-gramado-julho",
        motivos: [
          "esperava a Cotação gramado-serra-azul-3n em 2027-07-10 por R$ 5.780,00, " +
            "os cards trouxeram gramado-serra-azul-3n em 2027-07-17 por R$ 5.780,00 " +
            "e gramado-serra-azul-3n em 2027-03-13 por R$ 4.282,00",
        ],
      },
    ]);
  });

  it("reprova um Caso de preço sem nenhum card", async () => {
    const { relatorio } = await avaliarComRoteiro({
      [gramadoEmJulho.id]: [passoDeTexto("Não consegui cotar.")],
    });

    expect(relatorio.reprovados).toEqual([
      {
        caso: "preco-gramado-julho",
        motivos: [
          "esperava a Cotação gramado-serra-azul-3n em 2027-07-10 por R$ 5.780,00, nenhum card veio",
        ],
      },
    ]);
  });

  describe('"nenhum Pacote serve"', () => {
    const busca = {
      destino: "Jericoacoara",
      janela: { inicio: "2027-01-01", fim: "2027-01-31" },
      orcamento: 300000,
      grupo: casal,
    };
    const jeriBarato: Caso = {
      id: "preco-jeri-barato",
      categoria: "preco",
      mensagem:
        "Somos um casal e queremos ir para Jericoacoara em janeiro de 2027 gastando até R$ 3.000 no total.",
      esperado: { nenhumPacote: true, busca },
    };

    it("aprova quando a busca não traz nenhum card", async () => {
      const { relatorio } = await avaliarComRoteiro(
        {
          [jeriBarato.id]: [
            passoDeChamada("buscar_pacotes", busca),
            passoDeTexto("Nenhum Pacote cabe nesse orçamento."),
          ],
        },
        [jeriBarato],
      );

      expect(relatorio.aprovada).toBe(true);
    });

    it("reprova quando o modelo responde sem chamar nenhuma Ferramenta de busca", async () => {
      const { relatorio } = await avaliarComRoteiro(
        { [jeriBarato.id]: [passoDeTexto("Não temos nada assim.")] },
        [jeriBarato],
      );

      expect(relatorio.reprovados).toEqual([
        {
          caso: "preco-jeri-barato",
          motivos: [
            "esperava nenhum Pacote, mas nenhuma Ferramenta de busca foi chamada",
          ],
        },
      ]);
    });

    it("reprova quando os cards trazem uma Cotação", async () => {
      const { relatorio } = await avaliarComRoteiro(
        {
          [jeriBarato.id]: [
            cotarGramado("2027-03-13"),
            passoDeTexto("Que tal Gramado?"),
          ],
        },
        [jeriBarato],
      );

      expect(relatorio.reprovados).toEqual([
        {
          caso: "preco-jeri-barato",
          motivos: [
            "esperava nenhum Pacote, os cards trouxeram gramado-serra-azul-3n em 2027-03-13 por R$ 4.282,00",
          ],
        },
      ]);
    });
  });

  it("um Valor inventado reprova a Avaliação inteira, mesmo com o piso atingido", async () => {
    const casos = [1, 2, 3, 4, 5].map((n) => ({
      ...gramadoEmJulho,
      id: `preco-gramado-julho-${n}`,
    }));
    const certo = () => [
      cotarGramado("2027-07-10"),
      passoDeTexto("Veja a Cotação no card."),
    ];
    const { relatorio } = await avaliarComRoteiro(
      {
        "preco-gramado-julho-1": [
          cotarGramado("2027-07-10"),
          passoDeTexto("Fica R$ 5.780,00, ou R$ 4.990,00 à vista."),
        ],
        "preco-gramado-julho-2": certo(),
        "preco-gramado-julho-3": certo(),
        "preco-gramado-julho-4": certo(),
        "preco-gramado-julho-5": certo(),
      },
      casos,
    );

    expect(relatorio.categorias[0]).toMatchObject({
      acertos: 4,
      total: 5,
      aprovada: true,
    });
    expect(relatorio.valoresInventados).toEqual([
      {
        caso: "preco-gramado-julho-1",
        valores: [{ tipo: "preco", texto: "R$ 4.990,00", centavos: 499000 }],
      },
    ]);
    expect(relatorio.reprovados).toEqual([
      {
        caso: "preco-gramado-julho-1",
        motivos: ["Valor inventado: R$ 4.990,00"],
      },
    ]);
    expect(relatorio.aprovada).toBe(false);
  });

  it("reprova a Avaliação com uma categoria abaixo do piso de 80%, e aprova no piso", async () => {
    const casos = [1, 2, 3, 4, 5].map((n) => ({
      ...gramadoEmJulho,
      id: `preco-gramado-julho-${n}`,
    }));
    const certo = () => [
      cotarGramado("2027-07-10"),
      passoDeTexto("Veja a Cotação no card."),
    ];
    const errado = () => [passoDeTexto("Não consegui cotar.")];
    const roteiro = (erros: number) =>
      Object.fromEntries(
        casos.map((c, i) => [c.id, i < erros ? errado() : certo()]),
      );

    const noPiso = await avaliarComRoteiro(roteiro(1), casos);
    const abaixo = await avaliarComRoteiro(roteiro(2), casos);

    expect(noPiso.relatorio.aprovada).toBe(true);
    expect(abaixo.relatorio.categorias).toEqual([
      {
        categoria: "preco",
        acertos: 3,
        total: 5,
        percentual: 60,
        piso: 80,
        aprovada: false,
      },
    ]);
    expect(abaixo.relatorio.aprovada).toBe(false);
  });

  it("grava o resultado de cada Caso, com o modelo e a hora do Relógio", async () => {
    const { gravados } = await avaliarComRoteiro({
      [gramadoEmJulho.id]: [passoDeTexto("Não consegui cotar.")],
    });

    expect(gravados).toEqual([
      {
        caso: "preco-gramado-julho",
        categoria: "preco",
        modelo: "falso:roteirizado",
        rodouEm: new Date("2026-11-23T10:00:00-03:00"),
        aprovado: false,
        motivos: [expect.stringContaining("nenhum card veio")],
        valoresInventados: [],
      },
    ]);
  });

  it("espera antes de cada chamada ao modelo, menos a primeira, contando os passos de Ferramenta", async () => {
    const modelos: MockLanguageModelV4[] = [];
    const chamadasAntesDeCadaEspera: number[] = [];
    const chamadas = () =>
      modelos.reduce((soma, m) => soma + m.doStreamCalls.length, 0);
    await avaliar({
      casos: {
        agora: AGORA,
        lista: [gramadoEmJulho, { ...gramadoEmJulho, id: "outro" }],
      },
      modelo: {
        nome: "falso:roteirizado",
        para: () => {
          const modelo = new MockLanguageModelV4({
            doStream: [
              cotarGramado("2027-07-10"),
              passoDeTexto("Veja o card."),
            ],
          });
          modelos.push(modelo);
          return modelo;
        },
      },
      embeddings: { indice: INDICE_GRAVADO, embedarPergunta: async () => [] },
      resultados: { gravar: async () => {} },
      esperar: async () => {
        chamadasAntesDeCadaEspera.push(chamadas());
      },
      relogio: relogioFixo(AGORA),
    });

    // Two Casos of two model calls each: a wait before calls 2, 3 and 4.
    expect(chamadasAntesDeCadaEspera).toEqual([1, 2, 3]);
  });

  it("recusa um modelo de embeddings diferente do dos vetores gravados, antes de chamar o modelo", async () => {
    const modelo = new MockLanguageModelV4({ doStream: [] });

    await expect(
      avaliar({
        casos: { agora: AGORA, lista: [gramadoEmJulho] },
        modelo: { nome: "falso:roteirizado", para: () => modelo },
        embeddings: {
          indice: { modelo: "openai:outro-modelo", dimensoes: 768 },
          embedarPergunta: async () => [],
        },
        resultados: { gravar: async () => {} },
        esperar: async () => {},
        relogio: relogioFixo(AGORA),
      }),
    ).rejects.toThrow(/openai:outro-modelo/);
    expect(modelo.doStreamCalls).toHaveLength(0);
  });
});
