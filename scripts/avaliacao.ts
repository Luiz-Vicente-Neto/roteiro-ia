// `pnpm avaliacao`: runs the Casos against the Assistente with the model in
// MODELO (docs/adr/0007), prints the Relatório and writes it to
// .avaliacao/relatorio.md. Exits non-zero only when the Avaliação fails.
// Needs the provider's key; only the questions the model sends to
// buscar_politicas are embedded, with the model in EMBEDDINGS.
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { resolverEmbeddings, resolverModelo } from "../src/assistente";
import { avaliar, CASOS, relatorioEmMarkdown } from "../src/avaliacao";
import { relogioDoSistema } from "../src/catalogo";
import { loadDotEnv } from "../src/db/env";

/** Kept out of Git (.gitignore). */
const PASTA = ".avaliacao";

/**
 * Requests per minute the model takes. 5 is the free Gemini Flash tier
 * (docs/adr/0004): at most one call every 12 seconds.
 */
const RPM = 5;

loadDotEnv();
const nomeDoModelo = process.env.MODELO ?? "";
const modelo = resolverModelo(process.env);
const embeddings = resolverEmbeddings(process.env);

await mkdir(PASTA, { recursive: true });
const arquivoDeResultados = `${PASTA}/resultados.jsonl`;
console.log(
  `Avaliando ${CASOS.lista.length} Casos com ${nomeDoModelo}, no máximo ${RPM} chamadas por minuto…`,
);

const relatorio = await avaliar({
  casos: CASOS,
  modelo: { nome: nomeDoModelo, para: () => modelo },
  embeddings,
  resultados: {
    async gravar(resultado) {
      console.log(
        `${resultado.aprovado ? "✓" : "✗"} ${resultado.caso}${resultado.aprovado ? "" : `: ${resultado.motivos.join("; ")}`}`,
      );
      await appendFile(arquivoDeResultados, `${JSON.stringify(resultado)}\n`);
    },
  },
  esperar: () => new Promise((pronto) => setTimeout(pronto, (60 / RPM) * 1000)),
  relogio: relogioDoSistema(),
});

const markdown = relatorioEmMarkdown(relatorio);
await writeFile(`${PASTA}/relatorio.md`, markdown);
console.log(`\n${markdown}`);
console.log(`Relatório gravado em ${PASTA}/relatorio.md`);
// exitCode, not exit(): exiting with sockets still open trips a libuv
// assertion on Windows.
process.exitCode = relatorio.aprovada ? 0 : 1;
