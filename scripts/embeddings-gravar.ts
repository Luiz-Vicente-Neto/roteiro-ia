// `pnpm embeddings:gravar`: embeds every Trecho and every test question with
// the model in EMBEDDINGS and rewrites src/catalogo/vetores-gravados.json.
// Needs the provider's key. Run it after changing a Documento.
import { resolverEmbeddings } from "../src/assistente";
import {
  gravarVetores,
  indexarTrechos,
  PERGUNTAS_GRAVADAS,
  trechosDosDocumentos,
} from "../src/catalogo";
import { loadDotEnv } from "../src/db/env";

// A provider failure (a 429 from the quota, a bad key) would print the AI
// SDK's whole stack, which buries the cause. One line says it, and nothing
// is written: the JSON is only rewritten at the end.
process.on("uncaughtException", (erro) => {
  const { statusCode } = erro as { statusCode?: number };
  console.error(
    `✗ Nada foi gravado. ${statusCode ? `HTTP ${statusCode}: ` : ""}${erro.message}`,
  );
  // exitCode, not exit(): exiting with sockets still open trips a libuv
  // assertion on Windows.
  process.exitCode = 1;
});

loadDotEnv();
const { indice, embedarPergunta, embedarTrechos } = resolverEmbeddings(
  process.env,
);

// Gemini's free tier embeds at most 100 texts a minute, and the corpus has
// more: the texts go in lots, waiting for the next minute when one would
// pass the limit.
const TEXTOS_POR_MINUTO = 90;
let usadosNoMinuto = 0;
async function reservar(textos: number) {
  if (usadosNoMinuto + textos > TEXTOS_POR_MINUTO) {
    console.log("… cota de embeddings do minuto cheia, esperando 1 minuto");
    await new Promise((pronto) => setTimeout(pronto, 61_000));
    usadosNoMinuto = 0;
  }
  usadosNoMinuto += textos;
}

const indexados = await indexarTrechos({
  trechos: trechosDosDocumentos(),
  // Nothing recorded counts: every vector is made again.
  gravados: { ...indice, trechos: {}, perguntas: {} },
  indice,
  async embedarTrechos(textos) {
    const vetores: number[][] = [];
    for (let i = 0; i < textos.length; i += TEXTOS_POR_MINUTO) {
      const lote = textos.slice(i, i + TEXTOS_POR_MINUTO);
      await reservar(lote.length);
      vetores.push(...(await embedarTrechos(lote)));
    }
    return vetores;
  },
});
const perguntas: Record<string, number[]> = {};
for (const pergunta of PERGUNTAS_GRAVADAS) {
  await reservar(1);
  perguntas[pergunta] = await embedarPergunta(pergunta);
}

gravarVetores({
  ...indice,
  trechos: Object.fromEntries(
    indexados.map((t) => [t.id, { hash: t.hash, vetor: t.vetor }]),
  ),
  perguntas,
});
console.log(
  `✓ ${indexados.length} Trechos e ${PERGUNTAS_GRAVADAS.length} perguntas gravados com ${indice.modelo}`,
);
