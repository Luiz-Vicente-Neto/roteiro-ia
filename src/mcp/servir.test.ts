import {
  Client,
  InMemoryTransport,
  type JSONRPCMessage,
} from "@modelcontextprotocol/client";
import type { Transport } from "@modelcontextprotocol/server";
import { describe, expect, test, vi } from "vitest";
import { criarBaseEmMemoria, criarCatalogo, relogioFixo } from "../catalogo";
import { catalogoDeTeste } from "../catalogo/catalogo-de-teste";
import { buscaNosTextosDeTeste } from "../catalogo/textos-de-teste";
import { servirMcp } from "./index";

function novoCatalogo() {
  return criarCatalogo({
    ...buscaNosTextosDeTeste(),
    base: criarBaseEmMemoria(catalogoDeTeste),
    relogio: relogioFixo("2026-12-01T09:00:00-03:00"),
  });
}

/** The `server/discover` the official client sends to probe for 2026-07-28. */
async function pedidoDeSondagem(): Promise<JSONRPCMessage> {
  let sondagem: JSONRPCMessage | undefined;
  const captura = {
    async start() {},
    async close() {},
    async send(mensagem: JSONRPCMessage) {
      if ("method" in mensagem && mensagem.method === "server/discover") {
        sondagem = mensagem;
        throw new Error("capturada");
      }
    },
  };
  await new Client(
    { name: "teste", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  )
    .connect(captura as unknown as Transport)
    .catch(() => {});
  if (!sondagem) throw new Error("o cliente não sondou");
  return sondagem;
}

/** A raw client end: send a message, wait for the answer with its id. */
function ladoDoCliente(transporte: InMemoryTransport) {
  const esperando = new Map<unknown, (resposta: JSONRPCMessage) => void>();
  transporte.onmessage = (mensagem) => {
    if ("id" in mensagem) esperando.get(mensagem.id)?.(mensagem);
  };
  return {
    pedir(mensagem: JSONRPCMessage & { id: string | number }) {
      return new Promise<JSONRPCMessage>((responder) => {
        esperando.set(mensagem.id, responder);
        void transporte.send(mensagem);
      });
    },
    avisar(mensagem: JSONRPCMessage) {
      return transporte.send(mensagem);
    },
  };
}

describe("servirMcp", () => {
  test("um cliente que sonda 2026 e volta para 2025 não fecha a conexão com o banco", async () => {
    const [doCliente, doServidor] = InMemoryTransport.createLinkedPair();
    const aoFechar = vi.fn();
    servirMcp(novoCatalogo(), {
      aoFechar,
      transport: doServidor as unknown as Transport,
    });
    await doCliente.start();
    const cliente = ladoDoCliente(doCliente);

    await cliente.pedir(
      (await pedidoDeSondagem()) as JSONRPCMessage & { id: number },
    );
    await cliente.pedir({
      jsonrpc: "2.0",
      id: "inicio",
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "teste", version: "0.0.0" },
      },
    });
    await cliente.avisar({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    const resposta = await cliente.pedir({
      jsonrpc: "2.0",
      id: "vagas",
      method: "tools/call",
      params: {
        name: "verificar_disponibilidade",
        arguments: { pacote: "gramado-serra-azul-3n", data: "2027-01-09" },
      },
    });

    expect(resposta).toMatchObject({
      result: { structuredContent: { ok: true, vagasRestantes: 20 } },
    });
    expect(aoFechar).not.toHaveBeenCalled();
    await doCliente.close();
  });

  test("quando o cliente vai embora, aoFechar roda uma vez", async () => {
    const [doCliente, doServidor] = InMemoryTransport.createLinkedPair();
    const aoFechar = vi.fn();
    servirMcp(novoCatalogo(), {
      aoFechar,
      transport: doServidor as unknown as Transport,
    });
    const cliente = new Client({ name: "teste", version: "0.0.0" });
    await cliente.connect(doCliente);
    await cliente.listTools();

    await cliente.close();

    await vi.waitFor(() => expect(aoFechar).toHaveBeenCalledTimes(1));
  });

  test("close() da conexão, como num SIGINT, chama aoFechar uma vez", async () => {
    const [doCliente, doServidor] = InMemoryTransport.createLinkedPair();
    const aoFechar = vi.fn();
    const conexao = servirMcp(novoCatalogo(), {
      aoFechar,
      transport: doServidor as unknown as Transport,
    });
    const cliente = new Client({ name: "teste", version: "0.0.0" });
    await cliente.connect(doCliente);
    await cliente.listTools();

    await conexao.close();
    await conexao.close();

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
