import { afterAll, describe, expect, inject, it } from "vitest";
import { ESCOPO_GERAL } from "../catalogo";
import { testarContratoDaBaseDeTrechos } from "../catalogo/base-de-trechos.contrato";
import { embedarPerguntaGravada } from "../catalogo/textos-de-teste";
import {
  criarBaseDeTrechosPostgres,
  substituirTrechos,
} from "./base-de-trechos-postgres";
import { createDb } from "./client";
import { sincronizarTrechos } from "./seed";

const db = createDb(inject("databaseUrl"));

afterAll(() => db.$client.end());

testarContratoDaBaseDeTrechos("Postgres", async (indice, trechos) => {
  await substituirTrechos(db, indice, trechos);
  return criarBaseDeTrechosPostgres(db);
});

describe("sincronizarTrechos", () => {
  it("monta a Base de Trechos com os vetores gravados, sem chave nem rede, quando o .env usa o modelo padrão", async () => {
    await substituirTrechos(db, { modelo: "x:y", dimensoes: 768 }, []);

    await sincronizarTrechos(db, {});

    const base = criarBaseDeTrechosPostgres(db);
    expect(await base.lerIndice()).toEqual({
      modelo: "google:gemini-embedding-2",
      dimensoes: 768,
    });
    const encontrados = await base.buscarPorSentido(
      await embedarPerguntaGravada("posso cancelar?"),
      2,
      ESCOPO_GERAL,
    );
    expect(encontrados.map((t) => t.id)).toContain(
      "politica-da-agencia#cancelamento",
    );
  });

  it("com outro modelo no .env, gera os vetores na hora, e por isso pede a chave dele", async () => {
    await expect(
      sincronizarTrechos(db, { EMBEDDINGS: "openai:text-embedding-3-large" }),
    ).rejects.toThrow(/OPENAI_API_KEY/);
  });
});
