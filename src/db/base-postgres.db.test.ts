import { afterAll, expect, inject, it } from "vitest";
import { criarCatalogo, relogioFixo } from "../catalogo";
import { testarContratoDaBase } from "../catalogo/base.contrato";
import { criarBasePostgres, substituirCatalogo } from "./base-postgres";
import { createDb } from "./client";
import { seed } from "./seed";

const db = createDb(inject("databaseUrl"));

afterAll(() => db.$client.end());

testarContratoDaBase("Postgres", async (dados) => {
  await substituirCatalogo(db, dados);
  return criarBasePostgres(db);
});

it("o catálogo responde verificarDisponibilidade com a Base em Postgres carregada pelo seed", async () => {
  await seed(db);
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

it("várias confirmações simultâneas disputando as últimas Vagas: só as que cabem são aceitas e o total nunca passa das Vagas totais", async () => {
  await seed(db);
  // 2027-01-23 of gramado-serra-azul-3n has 3 Vagas in the seed.
  const saida = { pacote: "gramado-serra-azul-3n", data: "2027-01-23" };
  const catalogo = criarCatalogo({
    base: criarBasePostgres(db),
    relogio: relogioFixo("2026-12-01T09:00:00-03:00"),
  });
  const ids: string[] = [];
  for (let i = 0; i < 8; i++) {
    const proposta = await catalogo.proporPreReserva({
      ...saida,
      grupo: { adultos: 1 },
    });
    if (!proposta.ok) throw new Error(proposta.mensagem);
    ids.push(proposta.id);
  }

  // The same Proposta twice too, so double confirmation races as well.
  const resultados = await Promise.all(
    [...ids, ids[0], ids[1]].map((id) => catalogo.confirmarPreReserva(id)),
  );

  const aceitas = resultados.filter((r) => r.ok);
  expect(aceitas).toHaveLength(3);
  for (const recusa of resultados.filter((r) => !r.ok)) {
    expect(["VAGAS_INSUFICIENTES", "PROPOSTA_JA_CONFIRMADA"]).toContain(
      recusa.erro,
    );
  }
  expect(await catalogo.verificarDisponibilidade(saida)).toMatchObject({
    vagasTotais: 3,
    vagasRestantes: 0,
  });
});
