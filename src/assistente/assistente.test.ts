import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
  MockLanguageModelV4,
} from "ai/test";
import { describe, expect, it } from "vitest";
import { criarBaseEmMemoria, criarCatalogo, relogioFixo } from "../catalogo";
import { catalogoDeTeste } from "../catalogo/catalogo-de-teste";
import {
  cardsDaResposta,
  chamadasDaResposta,
  chaveDoCard,
  criarAssistente,
} from ".";

const relogio = relogioFixo("2026-12-01T09:00:00-03:00");
const catalogo = criarCatalogo({
  base: criarBaseEmMemoria(catalogoDeTeste),
  relogio,
});

type RespostaRoteirizada = ConstructorParameters<
  typeof MockLanguageModelV4
>[0] extends infer O
  ? O extends { doStream?: infer D }
    ? Exclude<D, unknown[] | ((...args: never[]) => unknown)>
    : never
  : never;

const uso = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

/** One model step that answers with `texto`, in two deltas to show streaming. */
function passoDeTexto(conteudo: string): RespostaRoteirizada {
  const meio = Math.floor(conteudo.length / 2);
  return {
    stream: convertArrayToReadableStream([
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: conteudo.slice(0, meio) },
      { type: "text-delta", id: "t1", delta: conteudo.slice(meio) },
      { type: "text-end", id: "t1" },
      {
        type: "finish",
        finishReason: { unified: "stop", raw: undefined },
        usage: uso,
      },
    ]),
  };
}

/** One model step that calls the tool `nome` with `entrada`. */
function passoDeFerramenta(
  nome: string,
  entrada: unknown,
): RespostaRoteirizada {
  return {
    stream: convertArrayToReadableStream([
      {
        type: "tool-call",
        toolCallId: crypto.randomUUID(),
        toolName: nome,
        input: JSON.stringify(entrada),
      },
      {
        type: "finish",
        finishReason: { unified: "tool-calls", raw: undefined },
        usage: uso,
      },
    ]),
  };
}

function assistenteCom(modelo: MockLanguageModelV4) {
  return criarAssistente({ modelo, catalogo, relogio });
}

/** The first tool result the model received, in its second call. */
function resultadoVistoPeloModelo(modelo: MockLanguageModelV4) {
  return modelo.doStreamCalls[1]?.prompt
    .filter((m) => m.role === "tool")
    .flatMap((m) => m.content)
    .find((p) => p.type === "tool-result");
}

async function enviar(
  modelo: MockLanguageModelV4,
  mensagem = "4 dias em Gramado em julho, casal, até R$ 4 mil",
): Promise<UIMessageChunk[]> {
  const stream = assistenteCom(modelo).enviarMensagem({
    historico: [],
    texto: mensagem,
  });
  return convertReadableStreamToArray(stream);
}

describe("enviarMensagem", () => {
  it("oferece ao modelo exatamente as quatro ferramentas do catálogo, sem nenhuma de confirmar", async () => {
    const modelo = new MockLanguageModelV4({ doStream: passoDeTexto("Olá!") });

    await enviar(modelo);

    const nomes = (modelo.doStreamCalls[0]?.tools ?? []).map((t) => t.name);
    expect(nomes.sort()).toEqual([
      "buscar_pacotes",
      "consultar_preco",
      "propor_pre_reserva",
      "verificar_disponibilidade",
    ]);
  });

  it("entrega ao modelo a data de hoje do Relógio, nas instruções de sistema", async () => {
    const modelo = new MockLanguageModelV4({ doStream: passoDeTexto("Olá!") });

    await enviar(modelo);

    const sistema = modelo.doStreamCalls[0]?.prompt.find(
      (m) => m.role === "system",
    );
    expect(sistema?.content).toContain("2026-12-01");
  });

  it("executa a ferramenta pedida, devolve o resultado ao modelo e transmite a resposta final", async () => {
    const entrada = {
      pacote: "gramado-serra-azul-3n",
      data: "2027-01-09",
    };
    const modelo = new MockLanguageModelV4({
      doStream: [
        passoDeFerramenta("verificar_disponibilidade", entrada),
        passoDeTexto("Ainda há Vagas nessa Saída."),
      ],
    });

    const chunks = await enviar(modelo, "Tem vaga em 9 de janeiro?");

    const esperado = await catalogo.verificarDisponibilidade(entrada);
    const resultadoVisto = resultadoVistoPeloModelo(modelo);
    expect(resultadoVisto?.output).toEqual({ type: "json", value: esperado });

    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: "tool-output-available",
        output: esperado,
      }),
    );
    const textoTransmitido = chunks
      .flatMap((c) => (c.type === "text-delta" ? [c.delta] : []))
      .join("");
    expect(textoTransmitido).toBe("Ainda há Vagas nessa Saída.");
  });

  it("devolve ao modelo, como ENTRADA_INVALIDA do catálogo, uma chamada com entrada inválida", async () => {
    const modelo = new MockLanguageModelV4({
      doStream: [
        passoDeFerramenta("verificar_disponibilidade", {
          pacote: "gramado-serra-azul-3n",
          data: "09/01/2027",
        }),
        passoDeTexto("Vou corrigir a data."),
      ],
    });

    await enviar(modelo, "Tem vaga em 9 de janeiro?");

    const resultadoVisto = resultadoVistoPeloModelo(modelo);
    expect(resultadoVisto?.output).toEqual({
      type: "json",
      value: expect.objectContaining({ ok: false, erro: "ENTRADA_INVALIDA" }),
    });
  });

  it("para de executar ferramentas depois de 6 passos e obriga o modelo a responder em texto", async () => {
    // A confused model: it calls a tool whenever it is allowed to.
    const modelo = new MockLanguageModelV4({
      doStream: async ({ toolChoice, tools }) =>
        toolChoice?.type === "none" || !tools?.length
          ? passoDeTexto("Não encontrei o que você pediu.")
          : passoDeFerramenta("verificar_disponibilidade", {
              pacote: "gramado-serra-azul-3n",
              data: "2027-01-09",
            }),
    });

    const chunks = await enviar(modelo);

    const execucoes = chunks.filter((c) => c.type === "tool-output-available");
    expect(execucoes).toHaveLength(6);
    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: "text-delta",
        delta: expect.any(String),
      }),
    );
  });

  it.each([
    {
      caso: "ao abrir o stream",
      doStream: async () => {
        throw new Error("429 Too Many Requests: quota exceeded for key AIza…");
      },
    },
    {
      caso: "no meio do stream",
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: "text-start" as const, id: "t1" },
          { type: "text-delta" as const, id: "t1", delta: "Encontrei" },
          { type: "error" as const, error: new Error("503 upstream timeout") },
        ]),
      }),
    },
  ])(
    "transforma uma falha do provedor $caso na mensagem amigável, sem detalhe técnico",
    async ({ doStream }) => {
      const modelo = new MockLanguageModelV4({ doStream });

      const chunks = await enviar(modelo);

      const erros = chunks.filter((c) => c.type === "error");
      expect(erros).toEqual([
        {
          type: "error",
          errorText:
            "O Assistente está indisponível agora, tente de novo em instantes.",
        },
      ]);
    },
  );
});

/** The Assistente's answer as useChat assembles it from the stream. */
async function resposta(
  modelo: MockLanguageModelV4,
  mensagem = "4 dias em Gramado, casal",
): Promise<UIMessage> {
  const stream = assistenteCom(modelo).enviarMensagem({
    historico: [],
    texto: mensagem,
  });
  let ultima: UIMessage | undefined;
  for await (const m of readUIMessageStream({ stream })) ultima = m;
  if (!ultima) throw new Error("O stream não montou nenhuma mensagem");
  return ultima;
}

const casal = { adultos: 2, criancas: [] };
const buscaDeJaneiro = {
  grupo: casal,
  destino: "Gramado",
  janela: { inicio: "2027-01-01", fim: "2027-01-31" },
};
const buscaDeFevereiro = {
  grupo: casal,
  destino: "Gramado",
  janela: { inicio: "2027-02-01", fim: "2027-02-28" },
};

describe("cardsDaResposta", () => {
  it("numa resposta com duas chamadas de buscar_pacotes, só as Cotações da última viram cards", async () => {
    const modelo = new MockLanguageModelV4({
      doStream: [
        passoDeFerramenta("buscar_pacotes", buscaDeJaneiro),
        passoDeFerramenta("buscar_pacotes", buscaDeFevereiro),
        passoDeTexto("Veja as Cotações de fevereiro nos cards."),
      ],
    });

    const cards = cardsDaResposta(await resposta(modelo));

    const janeiro = await catalogo.buscarPacotes(buscaDeJaneiro);
    const fevereiro = await catalogo.buscarPacotes(buscaDeFevereiro);
    if (!janeiro.ok || !fevereiro.ok || !("cotacoes" in fevereiro)) {
      throw new Error("As buscas do teste precisam dar certo");
    }
    expect(fevereiro.cotacoes.length).toBeGreaterThan(0);
    expect(cards).toEqual(fevereiro.cotacoes);
    expect(cards).not.toEqual(janeiro.cotacoes);
  });

  it("uma chamada de consultar_preco vira um card de Cotação", async () => {
    const entrada = {
      pacote: "gramado-serra-azul-3n",
      data: "2027-01-09",
      grupo: { adultos: 2, criancas: [4] },
    };
    const modelo = new MockLanguageModelV4({
      doStream: [
        passoDeFerramenta("consultar_preco", entrada),
        passoDeTexto("O preço está no card."),
      ],
    });

    const cards = cardsDaResposta(await resposta(modelo));

    const { ok: _, ...cotacao } = (await catalogo.consultarPreco(entrada)) as {
      ok: true;
    } & Record<string, unknown>;
    expect(cards).toEqual([cotacao]);
    expect(cards[0]).toMatchObject({
      pacote: { slug: "gramado-serra-azul-3n" },
      data: "2027-01-09",
    });
  });

  it("mostra uma vez só a mesma Cotação, cotada por consultar_preco e depois achada na última busca", async () => {
    const fevereiro = await catalogo.buscarPacotes(buscaDeFevereiro);
    if (!fevereiro.ok || !("cotacoes" in fevereiro)) {
      throw new Error("A busca do teste precisa dar certo");
    }
    const [primeira] = fevereiro.cotacoes;
    const modelo = new MockLanguageModelV4({
      doStream: [
        passoDeFerramenta("consultar_preco", {
          pacote: primeira?.pacote.slug,
          data: primeira?.data,
          grupo: casal,
        }),
        passoDeFerramenta("buscar_pacotes", buscaDeFevereiro),
        passoDeTexto("Veja os cards."),
      ],
    });

    const cards = cardsDaResposta(await resposta(modelo));

    expect(cards).toHaveLength(fevereiro.cotacoes.length);
    expect(new Set(cards.map(chaveDoCard)).size).toBe(cards.length);
  });

  it("mantém dois cards da mesma Saída cotada para Grupos diferentes", async () => {
    const saida = { pacote: "gramado-serra-azul-3n", data: "2027-01-09" };
    const modelo = new MockLanguageModelV4({
      doStream: [
        passoDeFerramenta("consultar_preco", { ...saida, grupo: casal }),
        passoDeFerramenta("consultar_preco", {
          ...saida,
          grupo: { adultos: 3, criancas: [] },
        }),
        passoDeTexto("Compare os cards."),
      ],
    });

    const cards = cardsDaResposta(await resposta(modelo));

    expect(cards.map((c) => c.grupo.adultos)).toEqual([2, 3]);
  });

  it("não faz card de uma chamada que falhou nem de verificar_disponibilidade", async () => {
    const modelo = new MockLanguageModelV4({
      doStream: [
        passoDeFerramenta("consultar_preco", {
          pacote: "gramado-serra-azul-3n",
          data: "09/01/2027",
          grupo: casal,
        }),
        passoDeFerramenta("verificar_disponibilidade", {
          pacote: "gramado-serra-azul-3n",
          data: "2027-01-09",
        }),
        passoDeTexto("Ainda há Vagas."),
      ],
    });

    expect(cardsDaResposta(await resposta(modelo))).toEqual([]);
  });
});

describe("chamadasDaResposta", () => {
  it("lista cada chamada de ferramenta da resposta, em ordem, com a entrada e a saída bruta", async () => {
    const modelo = new MockLanguageModelV4({
      doStream: [
        passoDeFerramenta("buscar_pacotes", buscaDeJaneiro),
        passoDeFerramenta("verificar_disponibilidade", {
          pacote: "gramado-serra-azul-3n",
          data: "09/01/2027",
        }),
        passoDeTexto("Pronto."),
      ],
    });

    const chamadas = chamadasDaResposta(await resposta(modelo));

    expect(chamadas).toEqual([
      {
        id: expect.any(String),
        ferramenta: "buscar_pacotes",
        ok: true,
        entrada: buscaDeJaneiro,
        saida: await catalogo.buscarPacotes(buscaDeJaneiro),
      },
      {
        id: expect.any(String),
        ferramenta: "verificar_disponibilidade",
        ok: false,
        entrada: { pacote: "gramado-serra-azul-3n", data: "09/01/2027" },
        saida: expect.objectContaining({ ok: false, erro: "ENTRADA_INVALIDA" }),
      },
    ]);
  });
});
