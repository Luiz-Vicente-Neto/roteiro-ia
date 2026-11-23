// `pnpm mcp:sonda`: starts `pnpm mcp` the way Claude Code does and checks it
// end to end, on the real Postgres. The client first probes the 2026 revision
// (server/discover), then falls back to 2025 (initialize) on the same
// connection, then calls a read. The in-memory tests cannot see what this
// sees: the stdio wiring, the .env, the pool, and the process exiting once
// stdin ends. Exit 0 when every step passes, 1 otherwise.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Client, type Transport } from "@modelcontextprotocol/client";

const RAIZ = join(import.meta.dirname, "..");
const ESPERA_MS = 15_000;

/** The discover message the official client writes, so it is never hand-built. */
async function mensagemDeDescoberta(): Promise<{ id: number }> {
  let descoberta: { id: number } | undefined;
  const captura: Transport = {
    async start() {},
    async close() {},
    async send(mensagem) {
      if ("method" in mensagem && mensagem.method === "server/discover") {
        descoberta = mensagem as unknown as { id: number };
      }
      // Stop the client here: only the message is needed.
      throw new Error("capturada");
    },
  };
  await new Client(
    { name: "mcp-sonda", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  )
    .connect(captura)
    .catch(() => {});
  if (!descoberta)
    throw new Error("o cliente oficial não enviou server/discover");
  return descoberta;
}

const descoberta = await mensagemDeDescoberta();

const filho = spawn(process.execPath, ["--import", "tsx", "scripts/mcp.ts"], {
  cwd: RAIZ,
  stdio: ["pipe", "pipe", "inherit"],
});
const terminou = new Promise<number | null>((ok) => filho.once("exit", ok));
const esperando = new Map<number, (resposta: Resposta) => void>();
createInterface({ input: filho.stdout }).on("line", (linha) => {
  const resposta = JSON.parse(linha) as Resposta;
  esperando.get(resposta.id)?.(resposta);
});

interface Resposta {
  id: number;
  result?: Record<string, unknown>;
  error?: { message: string };
}

function enviar(mensagem: object) {
  filho.stdin.write(`${JSON.stringify(mensagem)}\n`);
}

function pedir(mensagem: { id: number }): Promise<Resposta> {
  return new Promise((ok, falhou) => {
    const prazo = setTimeout(
      () => falhou(new Error(`sem resposta em ${ESPERA_MS / 1000} s`)),
      ESPERA_MS,
    );
    esperando.set(mensagem.id, (resposta) => {
      clearTimeout(prazo);
      ok(resposta);
    });
    enviar(mensagem);
  });
}

let falhas = 0;
function conferir(passo: string, passou: boolean, detalhe: string) {
  console.log(`${passou ? "ok  " : "FALHA"} ${passo}: ${detalhe}`);
  if (!passou) falhas++;
}

try {
  const sonda = await pedir(descoberta);
  conferir(
    "sonda 2026 (server/discover)",
    sonda.result !== undefined,
    JSON.stringify(sonda.result?.supportedVersions ?? sonda.error),
  );

  const inicio = await pedir({
    jsonrpc: "2.0",
    id: 100,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "mcp-sonda", version: "0.0.0" },
    },
  } as { id: number });
  conferir(
    "volta para 2025 (initialize)",
    inicio.result?.protocolVersion === "2025-06-18",
    JSON.stringify(inicio.result?.protocolVersion ?? inicio.error),
  );
  enviar({ jsonrpc: "2.0", method: "notifications/initialized" });

  // Any answer the catalog wrote (the Vagas, or a Falha such as a past date)
  // proves Postgres answered. A Drizzle exception ("Failed
  // query") comes back as plain text, not as the catalog's JSON.
  const chamada = await pedir({
    jsonrpc: "2.0",
    id: 101,
    method: "tools/call",
    params: {
      name: "verificar_disponibilidade",
      arguments: { pacote: "gramado-bavaria-palace-3n", data: "2027-01-22" },
    },
  } as { id: number });
  const texto =
    (chamada.result?.content as { text?: string }[] | undefined)?.[0]?.text ??
    chamada.error?.message ??
    "";
  let doCatalogo = false;
  try {
    doCatalogo = typeof JSON.parse(texto).ok === "boolean";
  } catch {}
  conferir(
    "leitura no Postgres (verificar_disponibilidade)",
    doCatalogo,
    texto.slice(0, 160),
  );
} catch (erro) {
  conferir(
    "conversa",
    false,
    erro instanceof Error ? erro.message : String(erro),
  );
}

// The client leaves: the server must close the pool and exit on its own.
filho.stdin.end();
const codigo = await Promise.race([
  terminou,
  new Promise<"preso">((ok) => setTimeout(() => ok("preso"), ESPERA_MS)),
]);
conferir(
  "o processo termina quando o cliente sai",
  codigo !== "preso",
  codigo === "preso"
    ? `ainda vivo depois de ${ESPERA_MS / 1000} s`
    : `código ${codigo}`,
);
if (codigo === "preso") filho.kill();

process.exit(falhas === 0 ? 0 : 1);
