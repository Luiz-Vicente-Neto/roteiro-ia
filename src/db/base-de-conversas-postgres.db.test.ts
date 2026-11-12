import { afterAll, inject } from "vitest";
import { testarContratoDaBaseDeConversas } from "../assistente/base.contrato";
import { criarBaseDeConversasPostgres } from "./base-de-conversas-postgres";
import { createDb } from "./client";

const db = createDb(inject("databaseUrl"));

afterAll(() => db.$client.end());

// Every case uses fresh random ids, so the tables need no cleaning in between.
testarContratoDaBaseDeConversas("Postgres", async () =>
  criarBaseDeConversasPostgres(db),
);
