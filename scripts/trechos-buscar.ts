// `pnpm trechos:buscar "<pergunta>" [--destino <slug>] [--pacote <slug>]`:
// where each Trecho lands in the search by meaning, the search by words and
// their fusion, in the scope buscar_politicas would use. In memory, with the
// recorded vectors: no Postgres, and no key for a question in
// PERGUNTAS_GRAVADAS. Tune a Documento's words here, then record once.
import { parseArgs } from "node:util";
import { indiceDosEmbeddings, resolverEmbeddings } from "../src/assistente";
import {
  baseDosVetoresGravados,
  conferirIndiceDosTrechos,
  criarBaseEmMemoria,
  criarCatalogo,
  type Embedar,
  lerVetoresGravados,
  relogioDoSistema,
  semente,
  type TrechoEncontrado,
  trechosDosDocumentos,
} from "../src/catalogo";
import { loadDotEnv } from "../src/db/env";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { destino: { type: "string" }, pacote: { type: "string" } },
});
const pergunta = positionals.join(" ");
if (!pergunta.trim()) {
  console.error(
    'Uso: pnpm trechos:buscar "<pergunta>" [--destino <slug>] [--pacote <slug>]',
  );
  process.exit(1);
}

loadDotEnv();
const gravados = lerVetoresGravados();
const { base, desatualizados, semVetor } = baseDosVetoresGravados(
  trechosDosDocumentos(),
  gravados,
);

// A recorded question needs no provider; any other is embedded with the
// model in EMBEDDINGS, which must be the one the Trechos were recorded with.
const embedarPergunta: Embedar = async (texto) => {
  const gravada = gravados.perguntas[texto];
  if (gravada) return gravada;
  await conferirIndiceDosTrechos(base, indiceDosEmbeddings(process.env));
  return resolverEmbeddings(process.env).embedarPergunta(texto);
};

const catalogo = criarCatalogo({
  base: criarBaseEmMemoria(semente),
  trechos: base,
  embedarPergunta,
  relogio: relogioDoSistema(),
});
const ranking = await catalogo.rankingDasPoliticas({
  pergunta,
  destino: values.destino,
  pacote: values.pacote,
});
if (!ranking.ok) {
  console.error(`✗ ${ranking.erro}: ${ranking.mensagem}`);
  if (ranking.sugestoes?.length) {
    console.error(`  sugestoes: ${ranking.sugestoes.join(", ")}`);
  }
  process.exit(1);
}

const posicoes = (lista: TrechoEncontrado[] | undefined) =>
  new Map(lista?.map((t, i) => [t.id, i + 1]));
const { porSentido, porPalavras, fundidos, devolvidos } = ranking;
const sentido = posicoes(porSentido.ok ? porSentido.trechos : undefined);
const palavras = posicoes(porPalavras);
const fusao = posicoes(fundidos);

// Every Trecho either search found, in the fusion's order (the words' order
// when there is no fusion).
const linhas = fundidos ?? porPalavras;
const coluna = (posicao: number | undefined) =>
  String(posicao ?? "—").padStart(9);
const marca = (id: string) =>
  desatualizados.includes(id)
    ? "  (desatualizado: vetor de antes da mudança)"
    : semVetor.includes(id)
      ? "  (sem vetor gravado: fora da busca por sentido)"
      : "";

console.log(`Pergunta: ${pergunta}`);
if (values.pacote ?? values.destino) {
  console.log(
    `Escopo: ${values.pacote ? `pacote ${values.pacote}` : `destino ${values.destino}`}`,
  );
}
if (!porSentido.ok) {
  console.log(`⚠ Busca por sentido não rodou: ${porSentido.motivo}`);
}
// Postgres also matches by stem (pt_unaccent): there a word can collide
// with more Trechos than here.
console.log(
  "ℹ A busca por palavras é a em memória, só por palavras inteiras; a do Postgres também casa pelo radical.",
);
console.log("");
console.log(
  `${"fusão".padStart(9)}${"sentido".padStart(9)}${"palavras".padStart(9)}  Trecho`,
);
linhas.forEach((trecho, i) => {
  if (fundidos && i === devolvidos) {
    console.log(`  ── buscar_politicas devolve só os ${devolvidos} de cima ──`);
  }
  console.log(
    `${coluna(fusao.get(trecho.id))}${coluna(sentido.get(trecho.id))}${coluna(palavras.get(trecho.id))}  ${trecho.id}  ${trecho.documento.titulo} › ${trecho.secao}${marca(trecho.id)}`,
  );
});
if (linhas.length === 0) console.log("  (nenhum Trecho)");
