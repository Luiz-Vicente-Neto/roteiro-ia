import type { Transport } from "@modelcontextprotocol/server";
import {
  StdioServerTransport,
  serveStdio,
} from "@modelcontextprotocol/server/stdio";
import type { Catalogo } from "../catalogo";
import { criarServidorMcp, type OpcoesDoServidorMcp } from "./servidor";

export interface OpcoesDeServir extends OpcoesDoServidorMcp {
  /** Runs once, when the connection ends (the client goes, stdin ends, or `close()`). */
  aoFechar: () => void;
  /** The wire; stdio by default. Tests pass an in-memory one. */
  transport?: Transport;
  onerror?: (erro: Error) => void;
}

/**
 * Serves the MCP server over stdio, as `pnpm mcp` does. `aoFechar` hangs on
 * the wire, never on a server instance: `serveStdio` may build a 2026 probe
 * instance for a client's `server/discover` and close it when the client
 * falls back to 2025, and that close is not the end of the connection.
 */
export function servirMcp(
  catalogo: Catalogo,
  {
    aoFechar,
    transport = new StdioServerTransport(),
    onerror,
    ...opcoesDoServidor
  }: OpcoesDeServir,
) {
  const conexao = serveStdio(
    () => criarServidorMcp(catalogo, opcoesDoServidor),
    {
      transport,
      onerror,
    },
  );
  // serveStdio owns the wire's onclose; chain after it.
  const doServeStdio = transport.onclose;
  let fechou = false;
  transport.onclose = () => {
    try {
      doServeStdio?.();
    } finally {
      if (!fechou) {
        fechou = true;
        aoFechar();
      }
    }
  };
  return conexao;
}
