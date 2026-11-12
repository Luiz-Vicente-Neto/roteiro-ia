// Server-side wiring shared by the /api/chat route and the pages: no rules here.
import { cookies } from "next/headers";
import { type Assistente, criarAssistente, resolverModelo } from "@/assistente";
import { criarCatalogo, relogioDoSistema } from "@/catalogo";
import { criarBaseDeConversasPostgres } from "@/db/base-de-conversas-postgres";
import { criarBasePostgres } from "@/db/base-postgres";
import { createDb } from "@/db/client";
import { databaseUrl } from "@/db/env";
import { COOKIE_DO_DONO, donoValido } from "./dono";

let assistente: Assistente | undefined;

/**
 * Built on the first request, not on import, so `next build` needs no key.
 * src/instrumentation.ts already checked MODELO and its key at server start.
 */
export function obterAssistente(): Assistente {
  if (!assistente) {
    const relogio = relogioDoSistema();
    const db = createDb(databaseUrl());
    assistente = criarAssistente({
      modelo: resolverModelo(process.env),
      catalogo: criarCatalogo({ base: criarBasePostgres(db), relogio }),
      conversas: criarBaseDeConversasPostgres(db),
      relogio,
    });
  }
  return assistente;
}

/** This request's dono, set by src/proxy.ts; undefined only if the proxy did not run. */
export async function donoDaVisita(): Promise<string | undefined> {
  const valor = (await cookies()).get(COOKIE_DO_DONO)?.value;
  return donoValido(valor) ? valor : undefined;
}
