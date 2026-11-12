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

    it("lista só as Conversas do dono, da última atividade mais recente para a mais antiga", async () => {
      const base = await criarBase();
      const dono = crypto.randomUUID();
      const antiga = novaConversa({
        dono,
        titulo: "Gramado em julho",
        ultimaAtividade: new Date("2026-12-01T10:00:00.000Z"),
      });
      const recente = novaConversa({
        dono,
        titulo: "Bonito com crianças",
        ultimaAtividade: new Date("2026-12-03T10:00:00.000Z"),
      });
      const doMeio = novaConversa({
        dono,
        ultimaAtividade: new Date("2026-12-02T10:00:00.000Z"),
      });
      await base.criarConversa(antiga);
      await base.criarConversa(recente);
      await base.criarConversa(doMeio);
      await base.criarConversa(novaConversa());

      expect(await base.listarConversas(dono)).toEqual([
        recente,
        doMeio,
        antiga,
      ]);
    });

    it("apagar uma Conversa apaga ela e os itens dela, e mais nenhuma", async () => {
      const base = await criarBase();
      const apagada = novaConversa();
      const outra = novaConversa({ dono: apagada.dono });
      await base.criarConversa(apagada);
      await base.criarConversa(outra);
      const agora = new Date("2026-12-01T12:06:00.000Z");
      await base.adicionarItem(apagada.id, doViajante, agora);
      await base.adicionarItem(outra.id, doAssistente, agora);

      await base.apagarConversa(apagada.id);

      expect(await base.lerConversa(apagada.id)).toBeUndefined();
      expect(await base.lerItens(apagada.id)).toEqual([]);
      expect(await base.listarConversas(apagada.dono)).toEqual([
        { ...outra, ultimaAtividade: agora },
      ]);
      expect(await base.lerItens(outra.id)).toEqual([doAssistente]);
    });

    it("apagar um id de Conversa que não existe não faz nada", async () => {
      const base = await criarBase();

      await expect(
        base.apagarConversa(crypto.randomUUID()),
      ).resolves.toBeUndefined();
    });

    it("apaga, com os itens, as Conversas de qualquer dono paradas desde antes do limite, e não as outras", async () => {
      const base = await criarBase();
      // Far in the past, so no other case's Conversa in a shared Base is touched.
      const limite = new Date("2001-01-01T00:00:00.000Z");
      const parada = novaConversa({
        ultimaAtividade: new Date("2000-12-31T23:59:59.999Z"),
      });
      const deOutroDono = novaConversa({
        ultimaAtividade: new Date("2000-06-01T00:00:00.000Z"),
      });
      const noLimite = novaConversa({ ultimaAtividade: limite });
      const recente = novaConversa({ dono: parada.dono });
      await base.criarConversa(parada);
      await base.criarConversa(deOutroDono);
      await base.criarConversa(noLimite);
      await base.criarConversa(recente);
      await base.adicionarItem(parada.id, doViajante, parada.ultimaAtividade);

      await base.apagarConversasParadasAntesDe(limite);

      expect(await base.lerConversa(parada.id)).toBeUndefined();
      expect(await base.lerItens(parada.id)).toEqual([]);
      expect(await base.lerConversa(deOutroDono.id)).toBeUndefined();
      expect(await base.lerConversa(noLimite.id)).toEqual(noLimite);
      expect(await base.listarConversas(parada.dono)).toEqual([recente]);
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
