// `pnpm avaliacao [--categoria <c>] [--caso <id>]`: runs the Casos against
// the Assistente with the model in MODELO (docs/adr/0007), prints the
// Relatório and writes it to .avaliacao/relatorio.md. Exits non-zero only
// when the Avaliação fails: an incompleta one (the provider's daily quota ran
// out) exits zero, and the next run resumes where it stopped, reusing every
// result in .avaliacao/resultados.jsonl with the same impressão digital.
// Needs the provider's key; only the questions the model sends to
// buscar_politicas are embedded, with the model in EMBEDDINGS. The juiz of
// the "não sei" and fora do escopo Casos is MODELO_JUIZ, or MODELO. One call
// every 60 / AVALIACAO_RPM seconds (default 5 per minute).
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  resolverEmbeddings,
  resolverModelo,
  resolverModeloDoJuiz,
} from "../src/assistente";
import {
  avaliar,
  CASOS,
  filtrarCasos,
  relatorioEmMarkdown,
  resolverRpm,
  resultadosEmArquivo,
} from "../src/avaliacao";
import { relogioDoSistema } from "../src/catalogo";
import { loadDotEnv } from "../src/db/env";

/** Kept out of Git (.gitignore). */
const PASTA = ".avaliacao";

const { values: filtro } = parseArgs({
  options: {
    categoria: { type: "string" },
    caso: { type: "string" },
  },
});

loadDotEnv();
const nomeDoModelo = process.env.MODELO ?? "";
const modelo = resolverModelo(process.env);
const juiz = resolverModeloDoJuiz(process.env);
const embeddings = resolverEmbeddings(process.env);
const rpm = resolverRpm(process.env);
const casos = filtrarCasos(CASOS, filtro);
const resultados = resultadosEmArquivo(`${PASTA}/resultados.jsonl`);

console.log(
  `Avaliando ${casos.lista.length} Casos com ${nomeDoModelo} (juiz: ${juiz.nome}), no máximo ${rpm} chamadas por minuto…`,
);

const relatorio = await avaliar({
  casos,
  modelo: { nome: nomeDoModelo, para: () => modelo },
  juiz: juiz.modelo,
  embeddings,
  resultados: {
    ler: resultados.ler,
    async gravar(resultado) {
      console.log(
        `${resultado.aprovado ? "✓" : "✗"} ${resultado.caso}${resultado.aprovado ? "" : `: ${resultado.motivos.join("; ")}`}`,
      );
      await resultados.gravar(resultado);
    },
  },
  rpm,
  esperar: (ms) => new Promise((pronto) => setTimeout(pronto, ms)),
  relogio: relogioDoSistema(),
});

const markdown = relatorioEmMarkdown(relatorio);
// The results file may never have been written: a 429 on the first Caso.
await mkdir(PASTA, { recursive: true });
await writeFile(`${PASTA}/relatorio.md`, markdown);
console.log(`\n${markdown}`);
console.log(`Relatório gravado em ${PASTA}/relatorio.md`);
// exitCode, not exit(): exiting with sockets still open trips a libuv
// assertion on Windows.
process.exitCode = relatorio.aprovada ? 0 : 1;
