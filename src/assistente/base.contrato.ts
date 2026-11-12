import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import type { BaseDeConversas, Conversa, ItemDaConversa } from "./base";

/** Builds an empty-or-shared Base de Conversas: each test uses fresh ids. */
export type CriarBaseDeConversas = () => Promise<BaseDeConversas>;

function novaConversa(campos: Partial<Conversa> = {}): Conversa {
  return {
    id: crypto.randomUUID(),
    dono: crypto.randomUUID(),
    titulo: "",
    criadaEm: new Date("2026-12-01T12:00:00.123Z"),
    ultimaAtividade: new Date("2026-12-01T12:00:00.123Z"),
    ...campos,
  };
}

const doViajante: ItemDaConversa = {
  tipo: "mensagem",
  mensagem: {
    id: "m1",
    role: "user",
    parts: [{ type: "text", text: "4 dias em Gramado, casal — até R$ 4 mil" }],
  },
};

// A tool call with its raw result, as the Assistente's answer keeps it.
const doAssistente: ItemDaConversa = {
  tipo: "mensagem",
  mensagem: {
    id: "m2",
    role: "assistant",
    parts: [
      { type: "step-start" },
      {
        type: "tool-verificar_disponibilidade",
        toolCallId: "c1",
        state: "output-available",
        input: { pacote: "gramado-serra-azul-3n", data: "2027-01-09" },
        output: { ok: true, vagasTotais: 10, vagasRestantes: 4, extra: null },
      },
      { type: "text", text: "Ainda há Vagas.", state: "done" },
    ],
  } satisfies UIMessage,
};

const evento: ItemDaConversa = {
  tipo: "evento",
  id: "e1",
  criadoEm: new Date("2026-12-01T12:05:00.456Z"),
  evento: {
    tipo: "proposta-descartada",
    idDaProposta: "a1".repeat(32),
  },
};

/** The same cases run against every Base de Conversas implementation. */
export function testarContratoDaBaseDeConversas(
  nome: string,
  criarBase: CriarBaseDeConversas,
) {
  describe(`Base de Conversas (${nome})`, () => {
    it("grava uma Conversa e a lê de volta pelo id, com o título vazio e os instantes exatos", async () => {
      const base = await criarBase();
      const conversa = novaConversa();

      await base.criarConversa(conversa);

      expect(await base.lerConversa(conversa.id)).toEqual(conversa);
    });

    it("lê undefined para um id de Conversa que nunca foi gravado", async () => {
      const base = await criarBase();

      expect(await base.lerConversa(crypto.randomUUID())).toBeUndefined();
    });

    it("uma Conversa nova não tem itens", async () => {
      const base = await criarBase();
      const conversa = novaConversa();
      await base.criarConversa(conversa);

      expect(await base.lerItens(conversa.id)).toEqual([]);
    });

    it("lê os itens na ordem em que foram adicionados: mensagens com as chamadas de ferramenta e os resultados, e Eventos", async () => {
      const base = await criarBase();
      const conversa = novaConversa();
      await base.criarConversa(conversa);
      const agora = new Date("2026-12-01T12:06:00.000Z");

      await base.adicionarItem(conversa.id, doViajante, agora);
      await base.adicionarItem(conversa.id, doAssistente, agora);
      await base.adicionarItem(conversa.id, evento, agora);

      expect(await base.lerItens(conversa.id)).toEqual([
        doViajante,
        doAssistente,
        evento,
      ]);
    });

    it("adicionar um item atualiza a última atividade da Conversa e mais nada", async () => {
      const base = await criarBase();
      const conversa = novaConversa();
      await base.criarConversa(conversa);
      const agora = new Date("2026-12-02T08:30:00.789Z");

      await base.adicionarItem(conversa.id, doViajante, agora);

      expect(await base.lerConversa(conversa.id)).toEqual({
        ...conversa,
        ultimaAtividade: agora,
      });
    });

    it("os itens de uma Conversa não aparecem em outra", async () => {
      const base = await criarBase();
      const uma = novaConversa();
      const outra = novaConversa({ dono: uma.dono });
      await base.criarConversa(uma);
      await base.criarConversa(outra);
      const agora = new Date("2026-12-01T12:06:00.000Z");

      await base.adicionarItem(uma.id, doViajante, agora);
      await base.adicionarItem(outra.id, doAssistente, agora);

      expect(await base.lerItens(uma.id)).toEqual([doViajante]);
      expect(await base.lerItens(outra.id)).toEqual([doAssistente]);
    });

    it("não deixa quem lê mudar o que ficou gravado", async () => {
      const base = await criarBase();
      const conversa = novaConversa();
      await base.criarConversa(conversa);
      await base.adicionarItem(
        conversa.id,
        structuredClone(doViajante),
        new Date(),
      );

      const [lido] = await base.lerItens(conversa.id);
      if (lido?.tipo === "mensagem") lido.mensagem.parts.length = 0;

      expect(await base.lerItens(conversa.id)).toEqual([doViajante]);
    });
  });
}
