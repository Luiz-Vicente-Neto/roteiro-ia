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

loadDotEnv();
const { indice, embedarPergunta, embedarTrechos } = resolverEmbeddings(
  process.env,
);

const indexados = await indexarTrechos({
  trechos: trechosDosDocumentos(),
  // Nothing recorded counts: every vector is made again.
  gravados: { ...indice, trechos: {}, perguntas: {} },
  indice,
  embedarTrechos,
});
const perguntas: Record<string, number[]> = {};
for (const pergunta of PERGUNTAS_GRAVADAS) {
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
