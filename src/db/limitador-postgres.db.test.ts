import { afterAll, inject } from "vitest";
import { testarContratoDoLimitador } from "../assistente/limitador.contrato";
import { createDb } from "./client";
import { criarLimitadorPostgres } from "./limitador-postgres";

const db = createDb(inject("databaseUrl"));

afterAll(() => db.$client.end());

// Every case uses fresh random chaves, so the table needs no cleaning in between.
testarContratoDoLimitador("Postgres", async () => criarLimitadorPostgres(db));
