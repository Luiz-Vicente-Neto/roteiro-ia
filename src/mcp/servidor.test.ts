import {
  Client,
  type ElicitRequestFormParams,
  InMemoryTransport,
} from "@modelcontextprotocol/client";
import {
  createRequestStateCodec,
  type Transport,
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import {
  type Catalogo,
  criarBaseEmMemoria,
  criarCatalogo,
  type Relogio,
  relogioFixo,
} from "../catalogo";
import { catalogoDeTeste } from "../catalogo/catalogo-de-teste";
import { buscaNosTextosDeTeste } from "../catalogo/textos-de-teste";
import { criarServidorMcp, type OpcoesDoServidorMcp } from "./index";

const LEITURAS = [
  "buscar_pacotes",
  "buscar_politicas",
  "consultar_preco",
  "verificar_disponibilidade",
];

const AGORA = "2026-12-01T09:00:00-03:00";

function novoCatalogo(relogio: Relogio = relogioFixo(AGORA)) {
  return criarCatalogo({
    ...buscaNosTextosDeTeste(),
    base: criarBaseEmMemoria(catalogoDeTeste),
    relogio,
  });
}

/** The catalog's clock, which a test moves forward with `avancar`. */
function relogioQueAnda() {
  let agora = relogioFixo(AGORA);
  return {
    relogio: { agora: () => agora.agora(), hoje: () => agora.hoje() },
    avancar(minutos: number) {
      agora = relogioFixo(
        new Date(agora.agora().getTime() + minutos * 60 * 1000),
      );
    },
  };
}

const abertos: Client[] = [];

afterEach(async () => {
  await Promise.all(abertos.splice(0).map((cliente) => cliente.close()));
});

/**
 * Serves the server over `transporte` the way `pnpm mcp` serves it on stdio:
 * the opening exchange picks the era (2025 or 2026-07-28).
 */
function servir(
  transporte: InMemoryTransport,
  catalogo: Catalogo,
  opcoes?: OpcoesDoServidorMcp,
) {
  serveStdio(() => criarServidorMcp(catalogo, opcoes), {
    transport: transporte as unknown as Transport,
  });
}

/** The official client, connected in memory to the server over `catalogo`. */
async function conectar(catalogo = novoCatalogo()) {
  const [doCliente, doServidor] = InMemoryTransport.createLinkedPair();
  servir(doServidor, catalogo);
  const cliente = new Client({ name: "teste", version: "0.0.0" });
  await cliente.connect(doCliente);
  abertos.push(cliente);
  return { cliente, catalogo };
}

const GRUPO = { adultos: 2, criancas: [7] };

describe("leituras", () => {
  test.each([
    ["buscar_pacotes", { grupo: GRUPO, destino: "Gramado" }],
    ["buscar_politicas", { pergunta: "posso cancelar?" }],
    [
      "consultar_preco",
      { pacote: "gramado-serra-azul-3n", data: "2027-01-09", grupo: GRUPO },
    ],
    [
      "verificar_disponibilidade",
      { pacote: "gramado-serra-azul-3n", data: "2027-01-09" },
    ],
  ])(
    "%s devolve o resultado do catálogo, estruturado e em texto",
    async (nome, entrada) => {
      const { cliente, catalogo } = await conectar();
      const ferramenta = catalogo.ferramentas.find((f) => f.nome === nome);
      const esperado = await ferramenta?.executar(entrada);
      expect(esperado).toMatchObject({ ok: true });

      const resultado = await cliente.callTool({
        name: nome,
        arguments: entrada,
      });

      expect(resultado.isError).toBeFalsy();
      expect(resultado.structuredContent).toEqual(esperado);
      expect(resultado.content).toEqual([
        { type: "text", text: JSON.stringify(esperado) },
      ]);
    },
  );

  test("buscar_pacotes devolve Cotações reais do catálogo", async () => {
    const { cliente } = await conectar();

    const resultado = await cliente.callTool({
      name: "buscar_pacotes",
      arguments: { grupo: { adultos: 2 }, destino: "gramado" },
    });

    const { cotacoes } = resultado.structuredContent as {
      cotacoes: { pacote: { slug: string }; total: number }[];
    };
    expect(cotacoes.length).toBeGreaterThan(0);
    expect(cotacoes[0]).toMatchObject({
      pacote: { slug: expect.stringMatching(/^gramado-/) },
      total: expect.any(Number),
    });
  });
});

describe("falhas do catálogo", () => {
  test("Destino desconhecido volta com isError, a mensagem e as sugestões", async () => {
    const { cliente } = await conectar();

    const resultado = await cliente.callTool({
      name: "buscar_pacotes",
      arguments: { grupo: GRUPO, destino: "Atlântida" },
    });

    expect(resultado.isError).toBe(true);
    const [bloco] = resultado.content as { type: string; text: string }[];
    expect(JSON.parse(bloco.text)).toMatchObject({
      ok: false,
      erro: "DESTINO_DESCONHECIDO",
      mensagem: expect.any(String),
      sugestoes: ["Gramado"],
    });
  });

  test("data que não é Saída volta com isError e as Saídas mais próximas", async () => {
    const { cliente } = await conectar();

    const resultado = await cliente.callTool({
      name: "consultar_preco",
      arguments: {
        pacote: "gramado-serra-azul-3n",
        data: "2027-01-10",
        grupo: GRUPO,
      },
    });

    expect(resultado.isError).toBe(true);
    const [bloco] = resultado.content as { type: string; text: string }[];
    expect(JSON.parse(bloco.text)).toMatchObject({
      ok: false,
      erro: "SAIDA_INEXISTENTE",
      sugestoes: expect.arrayContaining(["2027-01-09", "2027-01-16"]),
    });
  });
});

describe("lista de ferramentas", () => {
  test("tem as quatro leituras e propor_pre_reserva, e nenhuma que confirma", async () => {
    const { cliente } = await conectar();

    const { tools } = await cliente.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual(
      [...LEITURAS, "propor_pre_reserva"].sort(),
    );
    expect(tools.some((t) => /confirm/i.test(t.name))).toBe(false);
  });

  test("as leituras são somente leitura e de mundo fechado", async () => {
    const { cliente } = await conectar();

    const { tools } = await cliente.listTools();

    for (const tool of tools.filter((t) => LEITURAS.includes(t.name))) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        openWorldHint: false,
      });
    }
  });

  test("propor_pre_reserva escreve, só acrescenta, não é idempotente e é de mundo fechado", async () => {
    const { cliente } = await conectar();

    const { tools } = await cliente.listTools();

    const proposta = tools.find((t) => t.name === "propor_pre_reserva");
    expect(proposta?.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    });
    expect(proposta?._meta).toBeUndefined();
  });

  test("propor_pre_reserva tem descrição própria do MCP, que fala da pergunta de confirmação", async () => {
    const { cliente, catalogo } = await conectar();

    const { tools } = await cliente.listTools();

    const proposta = tools.find((t) => t.name === "propor_pre_reserva");
    const doChat = catalogo.ferramentas.find(
      (f) => f.nome === "propor_pre_reserva",
    );
    expect(proposta?.description).not.toBe(doChat?.descricao);
    expect(proposta?.description).toMatch(/pergunta/i);
    expect(proposta?.description).toMatch(/chat web/i);
  });

  test("nomes e schemas de entrada vêm da lista única do catálogo, e as descrições das leituras também", async () => {
    const { cliente, catalogo } = await conectar();

    const { tools } = await cliente.listTools();

    for (const tool of tools) {
      const ferramenta = catalogo.ferramentas.find((f) => f.nome === tool.name);
      if (ferramenta?.somenteLeitura) {
        expect(ferramenta.descricao).toBe(tool.description);
      }
      const { $schema: _, ...esperado } = z.toJSONSchema(
        ferramenta?.schemaDeEntrada ?? z.never(),
        { io: "input" },
      );
      const { $schema: __, ...recebido } = tool.inputSchema;
      expect(recebido).toEqual(esperado);
    }
  });
});

/** What a person answers in the client's confirmation dialog. */
type Resposta =
  | { action: "accept"; content: { confirmar: boolean } }
  | { action: "decline" }
  | { action: "cancel" };

const PROPOSTA = {
  pacote: "gramado-serra-azul-3n",
  data: "2027-01-09",
  grupo: { adultos: 2 },
};

interface Conexao {
  catalogo?: Catalogo;
  /** The protocol revision the client opens with. */
  era?: "2026-07-28" | "2025";
  /**
   * What the person answers in the client's confirmation dialog. Without it,
   * the client does not declare elicitation: it cannot ask anything.
   */
  resposta?: Resposta | (() => Promise<Resposta>);
  /** The server's key for the question's state. */
  opcoes?: OpcoesDoServidorMcp;
  /** Leave input_required results to the test, instead of answering them. */
  manual?: boolean;
}

/**
 * The official client connected to the server, and the questions it was
 * asked. By default it speaks 2026-07-28 (input_required); on 2025 the server
 * sends it an elicitation/create instead.
 */
async function conectarCliente({
  catalogo = novoCatalogo(),
  era = "2026-07-28",
  resposta,
  opcoes,
  manual = false,
}: Conexao = {}) {
  const [doCliente, doServidor] = InMemoryTransport.createLinkedPair();
  servir(doServidor, catalogo, opcoes);
  const cliente = new Client(
    { name: "teste", version: "0.0.0" },
    {
      capabilities: resposta ? { elicitation: { form: {} } } : {},
      ...(era === "2026-07-28"
        ? { versionNegotiation: { mode: { pin: "2026-07-28" } } }
        : {}),
      ...(manual ? { inputRequired: { autoFulfill: false } } : {}),
    },
  );
  const perguntas: ElicitRequestFormParams[] = [];
  if (resposta) {
    cliente.setRequestHandler("elicitation/create", async (pedido) => {
      perguntas.push(pedido.params as ElicitRequestFormParams);
      return typeof resposta === "function" ? resposta() : resposta;
    });
  }
  await cliente.connect(doCliente);
  abertos.push(cliente);
  return { cliente, catalogo, perguntas };
}

async function vagasRestantes(catalogo: Catalogo, data = PROPOSTA.data) {
  const resultado = await catalogo.verificarDisponibilidade({
    pacote: PROPOSTA.pacote,
    data,
  });
  if (!resultado.ok) throw new Error(resultado.mensagem);
  return resultado.vagasRestantes;
}

describe("propor_pre_reserva", () => {
  test.each(["2026-07-28", "2025"] as const)(
    "confirmada na pergunta (%s), cria a Pré-reserva e segura as Vagas",
    async (era) => {
      const { cliente, catalogo, perguntas } = await conectarCliente({
        era,
        resposta: { action: "accept", content: { confirmar: true } },
      });
      const antes = await vagasRestantes(catalogo);

      const resultado = await cliente.callTool({
        name: "propor_pre_reserva",
        arguments: PROPOSTA,
      });

      expect(resultado.isError).toBeFalsy();
      expect(resultado.structuredContent).toMatchObject({
        ok: true,
        preReserva: {
          codigo: expect.stringMatching(/^RT-/),
          pacote: PROPOSTA.pacote,
          data: PROPOSTA.data,
          total: 535200,
          expiraEm: expect.any(String),
        },
        cotacao: {
          pacote: { nome: "Gramado Essencial no Serra Azul", noites: 3 },
          precoPorPessoa: [{ preco: 267600 }, { preco: 267600 }],
          total: 535200,
        },
      });
      expect(perguntas).toHaveLength(1);
      expect(await vagasRestantes(catalogo)).toBe(antes - 2);
    },
  );
  test.each([
    ["recusada", { action: "decline" }],
    ["cancelada", { action: "cancel" }],
    [
      "respondida sem confirmar",
      { action: "accept", content: { confirmar: false } },
    ],
  ] as const)(
    "%s, não reserva nada e diz isso, sem isError",
    async (_, resposta) => {
      const { cliente, catalogo } = await conectarCliente({ resposta });
      const antes = await vagasRestantes(catalogo);

      const resultado = await cliente.callTool({
        name: "propor_pre_reserva",
        arguments: PROPOSTA,
      });

      expect(resultado.isError).toBeFalsy();
      expect(resultado.structuredContent).toMatchObject({
        ok: true,
        confirmada: false,
      });
      const [bloco] = resultado.content as { type: string; text: string }[];
      expect(bloco.text).toMatch(/não confirmou/i);
      expect(bloco.text).toMatch(/nada foi reservado/i);
      expect(await vagasRestantes(catalogo)).toBe(antes);
    },
  );
  test("a pergunta mostra Pacote, data, Grupo, total e validade, com um só campo booleano", async () => {
    const { cliente, perguntas } = await conectarCliente({
      resposta: { action: "decline" },
    });

    await cliente.callTool({
      name: "propor_pre_reserva",
      arguments: { ...PROPOSTA, grupo: { adultos: 2, criancas: [7] } },
    });

    expect(perguntas).toHaveLength(1);
    const [{ message, requestedSchema }] = perguntas;
    expect(message).toContain("Gramado Essencial no Serra Azul");
    expect(message).toContain("09/01/2027");
    expect(message).toContain("2 adultos e 1 criança (7 anos)");
    expect(message).toMatch(/R\$\s6\.690/);
    expect(message).toContain("09:15");
    expect(requestedSchema).toMatchObject({
      type: "object",
      properties: { confirmar: { type: "boolean" } },
    });
    expect(Object.keys(requestedSchema.properties)).toEqual(["confirmar"]);
  });
});

describe("cliente que não consegue perguntar", () => {
  test.each(["2026-07-28", "2025"] as const)(
    "falha fechada (%s): nada é reservado, e a mensagem aponta o chat web",
    async (era) => {
      const { cliente, catalogo } = await conectarCliente({ era });
      const antes = await vagasRestantes(catalogo);

      const resultado = await cliente.callTool({
        name: "propor_pre_reserva",
        arguments: PROPOSTA,
      });

      expect(resultado.isError).toBe(true);
      const [bloco] = resultado.content as { type: string; text: string }[];
      expect(bloco.text).toMatch(/não consegue pedir a confirmação/i);
      expect(bloco.text).toMatch(/nada foi reservado/i);
      expect(bloco.text).toMatch(/chat web/i);
      expect(await vagasRestantes(catalogo)).toBe(antes);
    },
  );
});

describe("estado da pergunta", () => {
  const CHAVE = new Uint8Array(32).fill(7);

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * A client that answers the question by hand: it gets the first round's
   * input_required, and the test chooses the requestState it echoes back.
   */
  async function primeiraRodada() {
    const conexao = await conectarCliente({
      resposta: { action: "accept", content: { confirmar: true } },
      opcoes: { chaveDoEstado: CHAVE },
      manual: true,
    });
    const rodada = (await conexao.cliente.callTool(
      { name: "propor_pre_reserva", arguments: PROPOSTA },
      { allowInputRequired: true },
    )) as unknown as {
      requestState: string;
      inputRequests: Record<string, unknown>;
    };
    expect(rodada.requestState).toEqual(expect.any(String));
    const [pergunta] = Object.keys(rodada.inputRequests);
    const aceita = {
      [pergunta]: { action: "accept", content: { confirmar: true } },
    };
    return { ...conexao, requestState: rodada.requestState, aceita };
  }

  function repetir(
    cliente: Client,
    requestState: string,
    inputResponses: Record<string, unknown>,
  ) {
    return cliente.callTool({
      name: "propor_pre_reserva",
      arguments: PROPOSTA,
      inputResponses,
      requestState,
    } as Parameters<Client["callTool"]>[0]);
  }

  /** The Proposta id inside a state, which is signed but readable. */
  function propostaDoEstado(requestState: string): string {
    const [, corpo] = requestState.split(".");
    return JSON.parse(Buffer.from(corpo, "base64url").toString()).p.proposta;
  }

  test("o estado devolvido como veio, com accept, confirma", async () => {
    const { cliente, catalogo, requestState, aceita } = await primeiraRodada();
    const antes = await vagasRestantes(catalogo);

    const resultado = await repetir(cliente, requestState, aceita);

    expect(resultado.structuredContent).toMatchObject({ ok: true });
    expect(await vagasRestantes(catalogo)).toBe(antes - 2);
  });

  test("um estado adulterado é recusado sem reservar", async () => {
    const { cliente, catalogo, requestState, aceita } = await primeiraRodada();
    const outra = await catalogo.proporPreReserva(PROPOSTA);
    if (!outra.ok) throw new Error(outra.mensagem);
    const [versao, corpo, mac] = requestState.split(".");
    const conteudo = JSON.parse(Buffer.from(corpo, "base64url").toString());
    conteudo.p.proposta = outra.id;
    const adulterado = [
      versao,
      Buffer.from(JSON.stringify(conteudo)).toString("base64url"),
      mac,
    ].join(".");
    const antes = await vagasRestantes(catalogo);

    await expect(repetir(cliente, adulterado, aceita)).rejects.toThrow(
      /requestState/,
    );
    expect(await vagasRestantes(catalogo)).toBe(antes);
  });

  test("um estado assinado com outra chave é recusado sem reservar", async () => {
    const { cliente, catalogo, requestState, aceita } = await primeiraRodada();
    const forjado = await createRequestStateCodec({
      key: new Uint8Array(32).fill(9),
    }).mint({ proposta: propostaDoEstado(requestState) });
    const antes = await vagasRestantes(catalogo);

    await expect(repetir(cliente, forjado, aceita)).rejects.toThrow(
      /requestState/,
    );
    expect(await vagasRestantes(catalogo)).toBe(antes);
  });

  test("um estado vencido (mais de 15 minutos) é recusado sem reservar", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { cliente, catalogo, requestState, aceita } = await primeiraRodada();
    const antes = await vagasRestantes(catalogo);
    vi.setSystemTime(Date.now() + 15 * 60 * 1000 + 1000);

    await expect(repetir(cliente, requestState, aceita)).rejects.toThrow(
      /requestState/,
    );
    expect(await vagasRestantes(catalogo)).toBe(antes);
  });
});

describe("falhas da Pré-reserva", () => {
  function semPreReserva(resultado: Awaited<ReturnType<Client["callTool"]>>) {
    expect(resultado.isError).toBe(true);
    const [bloco] = resultado.content as { type: string; text: string }[];
    return JSON.parse(bloco.text);
  }

  test("Proposta expirada antes da resposta: accept volta como PROPOSTA_EXPIRADA, sem Pré-reserva", async () => {
    const { relogio, avancar } = relogioQueAnda();
    const { cliente, catalogo } = await conectarCliente({
      catalogo: novoCatalogo(relogio),
      resposta: async () => {
        avancar(16);
        return { action: "accept", content: { confirmar: true } };
      },
    });
    const antes = await vagasRestantes(catalogo);

    const resultado = await cliente.callTool({
      name: "propor_pre_reserva",
      arguments: PROPOSTA,
    });

    expect(semPreReserva(resultado)).toMatchObject({
      ok: false,
      erro: "PROPOSTA_EXPIRADA",
    });
    expect(await vagasRestantes(catalogo)).toBe(antes);
  });

  test("Vagas que acabam entre a pergunta e a resposta: accept volta como Falha, sem Pré-reserva", async () => {
    // The 2027-01-23 Saída has 3 Vagas: another Grupo takes 2 meanwhile.
    const data = "2027-01-23";
    const catalogo = novoCatalogo();
    const { cliente } = await conectarCliente({
      catalogo,
      resposta: async () => {
        const outra = await catalogo.proporPreReserva({ ...PROPOSTA, data });
        if (!outra.ok) throw new Error(outra.mensagem);
        await catalogo.confirmarPreReserva(outra.id);
        return { action: "accept", content: { confirmar: true } };
      },
    });

    const resultado = await cliente.callTool({
      name: "propor_pre_reserva",
      arguments: { ...PROPOSTA, data },
    });

    expect(semPreReserva(resultado)).toMatchObject({
      ok: false,
      erro: "VAGAS_INSUFICIENTES",
    });
    expect(await vagasRestantes(catalogo, data)).toBe(1);
  });

  test("uma Falha da primeira rodada volta direto, sem pergunta", async () => {
    const { cliente, perguntas } = await conectarCliente({
      resposta: { action: "accept", content: { confirmar: true } },
    });

    const resultado = await cliente.callTool({
      name: "propor_pre_reserva",
      arguments: { ...PROPOSTA, data: "2027-01-23", grupo: { adultos: 4 } },
    });

    expect(semPreReserva(resultado)).toMatchObject({
      ok: false,
      erro: "VAGAS_INSUFICIENTES",
      sugestoes: expect.any(Array),
    });
    expect(perguntas).toHaveLength(0);
  });
});
