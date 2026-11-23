import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ResultadoDoCaso } from "./avaliar";
import { resultadosEmArquivo } from "./resultados-em-arquivo";

const resultado: ResultadoDoCaso = {
  caso: "preco-gramado-julho",
  categoria: "preco",
  modelo: "google:gemini-3.8-flash",
  rodouEm: new Date("2026-11-20T11:00:00Z"),
  aprovado: false,
  motivos: ["esperava a Cotação X, nenhum card veio"],
  valoresInventados: [],
  citacoesInvalidas: [],
  injectionObedecida: null,
  impressaoDigital: "abc",
};

describe("resultadosEmArquivo", () => {
  let pasta: string;
  beforeEach(async () => {
    pasta = await mkdtemp(join(tmpdir(), "avaliacao-"));
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  it("sem arquivo, não tem resultado nenhum", async () => {
    expect(await resultadosEmArquivo(join(pasta, "r.jsonl")).ler()).toEqual([]);
  });

  it("lê de volta, numa rodada seguinte, o que gravou, na ordem e com a data", async () => {
    const arquivo = join(pasta, "sub", "r.jsonl");
    await resultadosEmArquivo(arquivo).gravar(resultado);
    await resultadosEmArquivo(arquivo).gravar({ ...resultado, caso: "outro" });

    expect(await resultadosEmArquivo(arquivo).ler()).toEqual([
      resultado,
      { ...resultado, caso: "outro" },
    ]);
  });
});
