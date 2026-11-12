// Postgres implementation of the Base de Conversas. Drizzle stays inside this
// adapter: a Conversa's row already has the domain's shape, and item rows are
// translated to ItemDaConversa on the way out.
import type { UIMessage } from "ai";
import { asc, desc, eq, lt } from "drizzle-orm";
import type { BaseDeConversas, Evento, ItemDaConversa } from "../assistente";
import type { Db } from "./client";
import { conversas, itensDeConversa } from "./schema";

export function criarBaseDeConversasPostgres(db: Db): BaseDeConversas {
  return {
    async criarConversa(conversa) {
      await db.insert(conversas).values(conversa);
    },

    async lerConversa(id) {
      const [row] = await db
        .select()
        .from(conversas)
        .where(eq(conversas.id, id));
      return row;
    },

    async lerItens(id) {
      const rows = await db
        .select()
        .from(itensDeConversa)
        .where(eq(itensDeConversa.conversa, id))
        .orderBy(asc(itensDeConversa.posicao));
      return rows.map(paraItem);
    },

    async adicionarItem(id, item, agora) {
      await db.transaction(async (tx) => {
        const [conversa] = await tx
          .update(conversas)
          .set({ ultimaAtividade: agora })
          .where(eq(conversas.id, id))
          .returning({ id: conversas.id });
        if (!conversa) throw new Error(`Conversa ${id} não existe`);
        await tx.insert(itensDeConversa).values(
          item.tipo === "mensagem"
            ? {
                conversa: id,
                tipo: "mensagem",
                id: item.mensagem.id,
                criadoEm: agora,
                conteudo: item.mensagem,
              }
            : {
                conversa: id,
                tipo: "evento",
                id: item.id,
                criadoEm: item.criadoEm,
                conteudo: item.evento,
              },
        );
      });
    },

    async listarConversas(dono) {
      return db
        .select()
        .from(conversas)
        .where(eq(conversas.dono, dono))
        .orderBy(desc(conversas.ultimaAtividade));
    },

    async apagarConversa(id) {
      // The items go with it, by the foreign key's cascade.
      await db.delete(conversas).where(eq(conversas.id, id));
    },

    async apagarConversasParadasAntesDe(limite) {
      await db.delete(conversas).where(lt(conversas.ultimaAtividade, limite));
    },
  };
}

function paraItem(row: typeof itensDeConversa.$inferSelect): ItemDaConversa {
  // jsonb holds exactly what adicionarItem wrote for each tipo.
  return row.tipo === "mensagem"
    ? { tipo: "mensagem", mensagem: row.conteudo as UIMessage }
    : {
        tipo: "evento",
        id: row.id,
        criadoEm: row.criadoEm,
        evento: row.conteudo as Evento,
      };
}
