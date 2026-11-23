// `pnpm mcp`: the MCP server over stdio, the catalog on Postgres with the
// embeddings, as in the web app. A client (Claude Code, through .mcp.json)
// starts it as a child process. stdout is the protocol: every log goes to
// stderr (console.error), never console.log.
import { join } from "node:path";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { resolverEmbeddings } from "../src/assistente";
import {
  conferirIndiceDosTrechos,
  criarCatalogo,
  relogioDoSistema,
} from "../src/catalogo";
import { criarBaseDeTrechosPostgres } from "../src/db/base-de-trechos-postgres";
import { criarBasePostgres } from "../src/db/base-postgres";
import { createDb } from "../src/db/client";
import { databaseUrl, loadDotEnv } from "../src/db/env";
import { criarServidorMcp } from "../src/mcp";

// The client picks the working directory, so the .env is found from this
// file. Variables the client already set (its `env`) win.
loadDotEnv(join(import.meta.dirname, "..", ".env"));

const db = createDb(databaseUrl());
let fechado = false;
/** Ends the Postgres pool, so the process exits once the client is gone. */
async function fechar() {
  if (fechado) return;
  fechado = true;
  await db.$client.end();
}

/** Drizzle wraps the driver's error ("Failed query"): the cause says why. */
function motivoDaFalha(erro: unknown): string {
  if (!(erro instanceof Error)) return String(erro);
  const causa = erro.cause instanceof Error ? erro.cause : undefined;
  const codigo = (causa as { code?: string } | undefined)?.code;
  return causa
    ? `${causa.message || codigo || causa.name} (${erro.message.split("\n")[0]})`
    : erro.message;
}

const trechos = criarBaseDeTrechosPostgres(db);
let embedarPergunta: ReturnType<typeof resolverEmbeddings>["embedarPergunta"];
// The web app's startup check (src/instrumentation.ts): EMBEDDINGS and its
// key, and Trechos indexed with that same model. A failure stops here, in the
// client's log, not in the middle of a conversation.
try {
  const embeddings = resolverEmbeddings(process.env);
  embedarPergunta = embeddings.embedarPergunta;
  await conferirIndiceDosTrechos(trechos, embeddings.indice);
} catch (erro) {
  console.error(
    `roteiro-ia (MCP) não iniciou: ${motivoDaFalha(erro)}\n` +
      "Confira se o Postgres está no ar (pnpm db:up && pnpm db:setup) e o .env.",
  );
  await fechar();
  process.exit(1);
}

const catalogo = criarCatalogo({
  base: criarBasePostgres(db),
  trechos,
  embedarPergunta,
  relogio: relogioDoSistema(),
});

const conexao = serveStdio(
  () => {
    const servidor = criarServidorMcp(catalogo);
    servidor.server.onclose = () => void fechar();
    return servidor;
  },
  { onerror: (erro) => console.error("roteiro-ia (MCP):", erro) },
);
// The client closing stdin ends the connection, even one that never opened.
process.stdin.once("end", () => void fechar());
for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.once(sinal, () => void conexao.close().then(fechar));
}
console.error("roteiro-ia (MCP) pronto no stdio.");
