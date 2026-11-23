import { type CallToolResult, McpServer } from "@modelcontextprotocol/server";
import type { Catalogo, Falha } from "../catalogo";

/**
 * The MCP server over a catalog already built. Each Ferramenta comes from the
 * catalog's single list, with its own name, input schema and description.
 * For now only those that only read: free to call, they change nothing.
 * No Assistente here: in MCP the model is the client's (docs/adr/0008).
 */
export function criarServidorMcp(catalogo: Catalogo): McpServer {
  const servidor = new McpServer({ name: "roteiro-ia", version: "0.1.0" });
  for (const ferramenta of catalogo.ferramentas) {
    if (!ferramenta.somenteLeitura) continue;
    servidor.registerTool(
      ferramenta.nome,
      {
        description: ferramenta.descricao,
        inputSchema: ferramenta.schemaDeEntrada,
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (entrada) => resultadoMcp(await ferramenta.executar(entrada)),
    );
  }
  return servidor;
}

/**
 * Success goes back as structured content plus the same JSON as text, which
 * the spec asks for older clients. A Falha is a tool error the client's model
 * reads and recovers from: `isError`, with the mensagem and the sugestoes.
 */
function resultadoMcp(resultado: { ok: true } | Falha): CallToolResult {
  const content = [{ type: "text" as const, text: JSON.stringify(resultado) }];
  if (!resultado.ok) return { isError: true, content };
  return { content, structuredContent: resultado };
}
