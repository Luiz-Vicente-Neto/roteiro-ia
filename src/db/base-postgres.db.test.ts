import { afterAll, expect, inject, it } from "vitest";
import { criarCatalogo, relogioFixo, semente } from "../catalogo";
import { testarContratoDaBase } from "../catalogo/base.contrato";
import { criarBasePostgres, substituirCatalogo } from "./base-postgres";
import { createDb } from "./client";

const db = createDb(inject("databaseUrl"));

afterAll(() => db.$client.end());

testarContratoDaBase("Postgres", async (dados) => {
  await substituirCatalogo(db, dados);
  return criarBasePostgres(db);
});

it("o catálogo responde verificarDisponibilidade com a Base em Postgres carregada pelo seed", async () => {
  await substituirCatalogo(db, semente);
  const catalogo = criarCatalogo({
    base: criarBasePostgres(db),
    relogio: relogioFixo("2026-12-01T09:00:00-03:00"),
  });

  expect(
    await catalogo.verificarDisponibilidade({
      pacote: "gramado-serra-azul-3n",
      data: "2027-01-23",
    }),
  ).toEqual({
    ok: true,
    pacote: "gramado-serra-azul-3n",
    data: "2027-01-23",
    vagasTotais: 3,
    vagasRestantes: 3,
  });
});
