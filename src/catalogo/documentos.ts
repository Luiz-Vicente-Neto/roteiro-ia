// The Documentos are Markdown files in ./documentos, so the corpus grows
// without touching code. Only the seed, the scripts and the tests read them:
// at runtime the Trechos come from the Base de Trechos.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TipoDeDocumento, Trecho } from "./tipos";

// A function, not a constant: the Next bundle imports this module but never
// reads the Documentos, and has no import.meta.dirname.
const pasta = () => join(import.meta.dirname, "documentos");

const TIPOS: readonly TipoDeDocumento[] = ["politica-da-agencia"];

/** Lowercase ASCII words joined by hyphens: "O que a Pré-reserva garante" → "o-que-a-pre-reserva-garante". */
function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The `chave: valor` lines between the two `---` at the top of a Documento. */
function lerCabecalho(arquivo: string, conteudo: string) {
  const encontrado = /^---\n([\s\S]*?)\n---\n/.exec(conteudo);
  if (!encontrado) throw new Error(`${arquivo}: falta o cabeçalho entre ---`);
  // Only the first colon separates: a titulo may hold more ("Hotel X: Centro").
  const campos = new Map(
    encontrado[1].split("\n").map((linha) => {
      const separador = linha.indexOf(":");
      return [
        linha.slice(0, separador).trim(),
        linha.slice(separador + 1).trim(),
      ];
    }),
  );
  const tipo = campos.get("tipo") as TipoDeDocumento | undefined;
  const titulo = campos.get("titulo");
  if (!tipo || !TIPOS.includes(tipo)) {
    throw new Error(`${arquivo}: tipo "${tipo}" desconhecido`);
  }
  if (!titulo) throw new Error(`${arquivo}: falta o titulo`);
  return { tipo, titulo, corpo: conteudo.slice(encontrado[0].length) };
}

/** Every `##` section of the Documento in `arquivo` becomes one Trecho. */
function trechosDoArquivo(arquivo: string): Trecho[] {
  const conteudo = readFileSync(join(pasta(), arquivo), "utf8").replace(
    /\r\n/g,
    "\n",
  );
  const { tipo, titulo, corpo } = lerCabecalho(arquivo, conteudo);
  const documento = { id: arquivo.replace(/\.md$/, ""), titulo };
  const [antes, ...secoes] = corpo.split(/^## /m);
  // Text outside a section would belong to no Trecho, and no search would find it.
  if (antes.trim()) {
    throw new Error(`${arquivo}: há texto antes da primeira seção ##`);
  }
  return secoes.map((bloco) => {
    const quebra = bloco.indexOf("\n");
    const secao = bloco.slice(0, quebra).trim();
    const textoCitado = bloco.slice(quebra + 1).trim();
    const textoEmbedado = `${titulo} › ${secao}\n\n${textoCitado}`;
    return {
      id: `${documento.id}#${slug(secao)}`,
      documento,
      tipoDoDocumento: tipo,
      secao,
      textoCitado,
      textoEmbedado,
      hash: createHash("sha256").update(textoEmbedado).digest("hex"),
    };
  });
}

/** The Trechos of every Documento, in file order and then section order. */
export function trechosDosDocumentos(): Trecho[] {
  return readdirSync(pasta())
    .filter((arquivo) => arquivo.endsWith(".md"))
    .sort()
    .flatMap(trechosDoArquivo);
}
