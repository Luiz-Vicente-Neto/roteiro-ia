import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import { createProviderRegistry, embed, embedMany } from "ai";
import type { Embedar, IndiceDosTrechos } from "../catalogo";

type Env = Record<string, string | undefined>;

/** Each provider reads its own standard key variable. Order is the one shown in errors. */
const PROVEDORES = {
  google: {
    chave: "GOOGLE_GENERATIVE_AI_API_KEY",
    criar: (apiKey: string) => createGoogleGenerativeAI({ apiKey }),
  },
  xai: {
    chave: "XAI_API_KEY",
    criar: (apiKey: string) => createXai({ apiKey }),
  },
  anthropic: {
    chave: "ANTHROPIC_API_KEY",
    criar: (apiKey: string) => createAnthropic({ apiKey }),
  },
  openai: {
    chave: "OPENAI_API_KEY",
    criar: (apiKey: string) => createOpenAI({ apiKey }),
  },
} as const;

type Provedor = keyof typeof PROVEDORES;

/**
 * The providers that make embeddings (the Claude API does not), each with how
 * a search wants its texts written. gemini-embedding-2 takes no task type:
 * the task goes in a prefix instead (docs/pesquisa/etapa-3-embeddings-e-busca-hibrida.md).
 */
const DE_EMBEDDINGS = {
  google: {
    pergunta: (texto: string) => `task: search result | query: ${texto}`,
    trecho: (texto: string) => `title: none | text: ${texto}`,
  },
  openai: {
    pergunta: (texto: string) => texto,
    trecho: (texto: string) => texto,
  },
} as const satisfies Partial<Record<Provedor, unknown>>;

/** The default when EMBEDDINGS is not set (docs/adr/0006). */
const EMBEDDINGS_PADRAO = "google:gemini-embedding-2";

/** Fixed by the `vector(768)` column: a Matryoshka size many models share (docs/adr/0006). */
const DIMENSOES = 768;

function ehDe<T extends object>(
  provedores: T,
  nome: string,
): nome is Extract<keyof T, string> {
  return Object.hasOwn(provedores, nome);
}

/**
 * Splits `NOME=provedor:modelo`, refusing a malformed value or a provider
 * outside `provedores`: it never falls back to another provider.
 */
function lerEscolha<T extends object>(
  nome: string,
  valor: string,
  provedores: T,
  exemplo: string,
) {
  const formato = `Use ${nome}=provedor:modelo no .env, como ${nome}=${exemplo}.`;
  const separador = valor.indexOf(":");
  const provedor = valor.slice(0, separador);
  const id = valor.slice(separador + 1);
  if (separador <= 0 || !id) {
    throw new Error(`${nome}=${valor} está malformado. ${formato}`);
  }
  if (!ehDe(provedores, provedor)) {
    throw new Error(
      `${nome}=${valor}: provedor "${provedor}" desconhecido. Os conhecidos são ${Object.keys(provedores).join(", ")}.`,
    );
  }
  return { provedor, id };
}

/** The provider's registry, refusing a missing key. */
function registroDo(nome: string, valor: string, provedor: Provedor, env: Env) {
  const { chave, criar } = PROVEDORES[provedor];
  const apiKey = env[chave];
  if (!apiKey) {
    throw new Error(
      `${nome}=${valor} usa o provedor ${provedor}, mas ${chave} não está definida no .env.`,
    );
  }
  return createProviderRegistry({ [provedor]: criar(apiKey) });
}

/**
 * The Assistente's model, chosen by `MODELO=provedor:modelo` (docs/adr/0004).
 * Throws a clear error for a malformed value, an unknown provider or a
 * missing key: it never falls back to another provider.
 */
export function resolverModelo(env: Env) {
  const valor = env.MODELO;
  if (!valor) {
    throw new Error(
      "MODELO não está definido. Use MODELO=provedor:modelo no .env, como MODELO=google:gemini-3.8-flash.",
    );
  }
  const { provedor, id } = lerEscolha(
    "MODELO",
    valor,
    PROVEDORES,
    "google:gemini-3.8-flash",
  );
  return registroDo("MODELO", valor, provedor, env).languageModel(
    `${provedor}:${id}`,
  );
}

/**
 * The embedding model chosen by `EMBEDDINGS=provedor:modelo` (docs/adr/0006),
 * without needing its key: the seed checks it against the recorded vectors.
 */
export function indiceDosEmbeddings(env: Env): IndiceDosTrechos {
  const valor = env.EMBEDDINGS || EMBEDDINGS_PADRAO;
  lerEscolha("EMBEDDINGS", valor, DE_EMBEDDINGS, EMBEDDINGS_PADRAO);
  return { modelo: valor, dimensoes: DIMENSOES };
}

export interface Embeddings {
  indice: IndiceDosTrechos;
  /** The vector of a Viajante's question, written the way the model searches with. */
  embedarPergunta: Embedar;
  /** The vectors of Trechos' embedded texts, in the same order. */
  embedarTrechos(textos: string[]): Promise<number[][]>;
}

/**
 * The embedding functions of the model in EMBEDDINGS. Throws like
 * resolverModelo for a malformed value, an unknown provider or a missing key.
 */
export function resolverEmbeddings(env: Env): Embeddings {
  const indice = indiceDosEmbeddings(env);
  const { provedor, id } = lerEscolha(
    "EMBEDDINGS",
    indice.modelo,
    DE_EMBEDDINGS,
    EMBEDDINGS_PADRAO,
  );
  const modelo = registroDo(
    "EMBEDDINGS",
    indice.modelo,
    provedor,
    env,
  ).embeddingModel(`${provedor}:${id}`);
  const escrever = DE_EMBEDDINGS[provedor];
  return {
    indice,
    async embedarPergunta(texto) {
      const { embedding } = await embed({
        model: modelo,
        value: escrever.pergunta(texto),
        dimensions: DIMENSOES,
      });
      return embedding;
    },
    async embedarTrechos(textos) {
      const { embeddings } = await embedMany({
        model: modelo,
        values: textos.map(escrever.trecho),
        dimensions: DIMENSOES,
      });
      return embeddings;
    },
  };
}
