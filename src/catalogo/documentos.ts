// The Documentos are Markdown files in ./documentos, so the corpus grows
// without touching code. Only the seed, the scripts and the tests read them:
// at runtime the Trechos come from the Base de Trechos.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { semente } from "./semente";
import type { TipoDeDocumento, Trecho } from "./tipos";

// A function, not a constant: the Next bundle imports this module but never
// reads the Documentos, and has no import.meta.dirname.
const pasta = () => join(import.meta.dirname, "documentos");

const TIPOS: readonly TipoDeDocumento[] = [
  "politica-da-agencia",
  "destino",
  "hotel",
  "faq",
];

/** The title of a FAQ; a Destino's FAQ adds the Destino's name. */
const FAQ = "Perguntas frequentes";

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
  if (!tipo || !TIPOS.includes(tipo)) {
    throw new Error(`${arquivo}: tipo "${tipo}" desconhecido`);
  }
  return {
    tipo,
    ...origemDoDocumento(arquivo, tipo, campos),
    corpo: conteudo.slice(encontrado[0].length),
  };
}

/**
 * Title, Destino and Hotel of a Documento. A Descrição names its Destino or
 * Hotel by slug and takes title and Destino from the catalog, where the
 * data rules; its file is named `<tipo>-<slug>.md`, so its id is predictable.
 */
function origemDoDocumento(
  arquivo: string,
  tipo: TipoDeDocumento,
  campos: Map<string, string>,
): {
  titulo: string;
  /** Prefix of the embedded text, before the section. */
  prefixo: string;
  destino?: string;
  hotel?: string;
} {
  const exigir = (campo: string) => {
    const valor = campos.get(campo);
    if (!valor) throw new Error(`${arquivo}: falta o campo ${campo}`);
    return valor;
  };
  const conferirNome = (slugEsperado: string) => {
    if (arquivo !== `${tipo}-${slugEsperado}.md`) {
      throw new Error(
        `${arquivo}: o arquivo deveria se chamar ${tipo}-${slugEsperado}.md`,
      );
    }
  };
  const destinoDe = (slugDoDestino: string) => {
    const destino = semente.destinos.find((d) => d.slug === slugDoDestino);
    if (!destino)
      throw new Error(`${arquivo}: Destino "${slugDoDestino}" não existe`);
    return destino;
  };
  if (tipo === "destino") {
    const destino = destinoDe(exigir("destino"));
    conferirNome(destino.slug);
    return {
      titulo: destino.nome,
      prefixo: destino.nome,
      destino: destino.slug,
    };
  }
  if (tipo === "hotel") {
    const slugDoHotel = exigir("hotel");
    const hotel = semente.hoteis.find((h) => h.slug === slugDoHotel);
    if (!hotel)
      throw new Error(`${arquivo}: Hotel "${slugDoHotel}" não existe`);
    conferirNome(hotel.slug);
    return {
      titulo: hotel.nome,
      prefixo: `${hotel.nome}, ${destinoDe(hotel.destino).nome}`,
      destino: hotel.destino,
      hotel: hotel.slug,
    };
  }
  if (tipo === "faq") {
    // A FAQ of a Destino is `faq-<slug>.md` and counts where the Destino's
    // Descrição counts; without one, it is `faq-geral.md` and counts everywhere.
    const slugDoDestino = campos.get("destino");
    if (!slugDoDestino) {
      conferirNome("geral");
      return { titulo: FAQ, prefixo: FAQ };
    }
    const destino = destinoDe(slugDoDestino);
    conferirNome(destino.slug);
    const titulo = `${FAQ} sobre ${destino.nome}`;
    return { titulo, prefixo: titulo, destino: destino.slug };
  }
  const titulo = exigir("titulo");
  return { titulo, prefixo: titulo };
}

/** Every `##` section of the Documento in `arquivo` (in a FAQ, every question) becomes one Trecho. */
function trechosDoArquivo(diretorio: string, arquivo: string): Trecho[] {
  const conteudo = readFileSync(join(diretorio, arquivo), "utf8").replace(
    /\r\n/g,
    "\n",
  );
  const { tipo, titulo, prefixo, destino, hotel, corpo } = lerCabecalho(
    arquivo,
    conteudo,
  );
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
    const textoEmbedado = `${prefixo} › ${secao}\n\n${textoCitado}`;
    return {
      id: `${documento.id}#${slug(secao)}`,
      documento,
      tipoDoDocumento: tipo,
      ...(destino && { destino }),
      ...(hotel && { hotel }),
      secao,
      textoCitado,
      textoEmbedado,
      hash: createHash("sha256").update(textoEmbedado).digest("hex"),
    };
  });
}

/** The Trechos of every Documento, in file order and then section order. */
export function trechosDosDocumentos(): Trecho[] {
  return trechosDaPasta(pasta());
}

/**
 * The Trechos of the Documentos in `diretorio`, written like the catalog's,
 * in file order and then section order. For Documentos that live outside
 * the catalog, such as the Avaliação's malicious ones.
 */
export function trechosDaPasta(diretorio: string): Trecho[] {
  return readdirSync(diretorio)
    .filter((arquivo) => arquivo.endsWith(".md"))
    .sort()
    .flatMap((arquivo) => trechosDoArquivo(diretorio, arquivo));
}
