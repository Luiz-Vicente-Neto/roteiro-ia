import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import { createProviderRegistry } from "ai";

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

const FORMATO =
  "Use MODELO=provedor:modelo no .env, como MODELO=google:gemini-3.8-flash.";

function ehProvedor(nome: string): nome is Provedor {
  return Object.hasOwn(PROVEDORES, nome);
}

/**
 * The Assistente's model, chosen by `MODELO=provedor:modelo` (docs/adr/0004).
 * Throws a clear error for a malformed value, an unknown provider or a
 * missing key: it never falls back to another provider.
 */
export function resolverModelo(env: Env) {
  const valor = env.MODELO;
  if (!valor) throw new Error(`MODELO não está definido. ${FORMATO}`);

  const separador = valor.indexOf(":");
  const provedor = valor.slice(0, separador);
  const id = valor.slice(separador + 1);
  if (separador <= 0 || !id) {
    throw new Error(`MODELO=${valor} está malformado. ${FORMATO}`);
  }
  if (!ehProvedor(provedor)) {
    throw new Error(
      `MODELO=${valor}: provedor "${provedor}" desconhecido. Os conhecidos são ${Object.keys(PROVEDORES).join(", ")}.`,
    );
  }

  const { chave, criar } = PROVEDORES[provedor];
  const apiKey = env[chave];
  if (!apiKey) {
    throw new Error(
      `MODELO=${valor} usa o provedor ${provedor}, mas ${chave} não está definida no .env.`,
    );
  }

  const registro = createProviderRegistry({ [provedor]: criar(apiKey) });
  return registro.languageModel(`${provedor}:${id}`);
}
