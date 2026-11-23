import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, test } from "vitest";
import { z } from "zod";
import { criarBaseEmMemoria, criarCatalogo, relogioFixo } from "../catalogo";
import { catalogoDeTeste } from "../catalogo/catalogo-de-teste";
import { buscaNosTextosDeTeste } from "../catalogo/textos-de-teste";
import { criarServidorMcp } from "./index";

const LEITURAS = [
  "buscar_pacotes",
  "buscar_politicas",
  "consultar_preco",
  "verificar_disponibilidade",
];

function novoCatalogo() {
  return criarCatalogo({
    ...buscaNosTextosDeTeste(),
    base: criarBaseEmMemoria(catalogoDeTeste),
    relogio: relogioFixo("2026-12-01T09:00:00-03:00"),
  });
}

const abertos: Client[] = [];

afterEach(async () => {
  await Promise.all(abertos.splice(0).map((cliente) => cliente.close()));
});

/** The official client, connected in memory to the server over `catalogo`. */
async function conectar(catalogo = novoCatalogo()) {
  const [doCliente, doServidor] = InMemoryTransport.createLinkedPair();
  await criarServidorMcp(catalogo).connect(doServidor);
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
  test("tem exatamente as quatro leituras, somente leitura e de mundo fechado", async () => {
    const { cliente } = await conectar();

    const { tools } = await cliente.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual(LEITURAS);
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        openWorldHint: false,
      });
    }
  });

  test("nomes, schemas de entrada e descrições vêm da lista única do catálogo", async () => {
    const { cliente, catalogo } = await conectar();

    const { tools } = await cliente.listTools();

    for (const tool of tools) {
      const ferramenta = catalogo.ferramentas.find((f) => f.nome === tool.name);
      expect(ferramenta?.descricao).toBe(tool.description);
      const { $schema: _, ...esperado } = z.toJSONSchema(
        ferramenta?.schemaDeEntrada ?? z.never(),
        { io: "input" },
      );
      const { $schema: __, ...recebido } = tool.inputSchema;
      expect(recebido).toEqual(esperado);
    }
  });
});
