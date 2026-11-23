// Postgres implementation of the Limitador: one row per chave and window,
// counted by an atomic upsert, so simultaneous messages never lose a count.
import { sql } from "drizzle-orm";
import type { Limitador } from "../assistente";
import type { Db } from "./client";
import { contagensDoLimitador } from "./schema";

export function criarLimitadorPostgres(db: Db): Limitador {
  return {
    async contar(chave, inicioDaJanela) {
      const [linha] = await db
        .insert(contagensDoLimitador)
        .values({ chave, inicioDaJanela, contagem: 1 })
        .onConflictDoUpdate({
          target: [
            contagensDoLimitador.chave,
            contagensDoLimitador.inicioDaJanela,
          ],
          set: { contagem: sql`${contagensDoLimitador.contagem} + 1` },
        })
        .returning({ contagem: contagensDoLimitador.contagem });
      if (!linha)
        throw new Error("O upsert do Limitador não devolveu a contagem");
      return linha.contagem;
    },
  };
}
