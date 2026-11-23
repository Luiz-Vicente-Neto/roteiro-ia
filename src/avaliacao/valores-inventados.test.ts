import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
  criarBaseEmMemoria,
  criarCatalogo,
  type NomeDeFerramenta,
  relogioFixo,
} from "../catalogo";
import { catalogoDeTeste } from "../catalogo/catalogo-de-teste";
import { buscaNosTextosDeTeste } from "../catalogo/textos-de-teste";
import { valoresInventados } from ".";

const catalogo = criarCatalogo({
  ...buscaNosTextosDeTeste(),
  base: criarBaseEmMemoria(catalogoDeTeste),
  relogio: relogioFixo("2026-12-01T09:00:00-03:00"),
});

// 2027-01-23 of gramado-serra-azul-3n: no Período, R$ 2.141,00 a person, 3 of 3 Vagas left.
const entrada = {
  pacote: "gramado-serra-azul-3n",
  data: "2027-01-23",
  grupo: { adultos: 2, criancas: [] },
};

interface ChamadaFeita {
  ferramenta: NomeDeFerramenta;
  entrada: unknown;
  saida: unknown;
}

/** An answer with these finished tool calls, then `texto`. */
function respostaCom(texto: string, ...chamadas: ChamadaFeita[]): UIMessage {
  return {
    id: "resposta",
    role: "assistant",
    parts: [
      ...chamadas.map((c, i): UIMessage["parts"][number] => ({
        type: `tool-${c.ferramenta}`,
        toolCallId: `c${i}`,
        state: "output-available",
        input: c.entrada,
        output: c.saida,
      })),
      { type: "text", text: texto },
    ],
  };
}

async function consultarPreco(): Promise<ChamadaFeita> {
  const saida = await catalogo.consultarPreco(entrada);
  if (!saida.ok) throw new Error(saida.mensagem);
  return { ferramenta: "consultar_preco", entrada, saida };
}

async function verificarDisponibilidade(): Promise<ChamadaFeita> {
  const pedido = { pacote: entrada.pacote, data: entrada.data };
  const saida = await catalogo.verificarDisponibilidade(pedido);
  if (!saida.ok) throw new Error(saida.mensagem);
  return { ferramenta: "verificar_disponibilidade", entrada: pedido, saida };
}

describe("valoresInventados", () => {
  it('aponta um "R$" que nenhuma Ferramenta devolveu', async () => {
    const resposta = respostaCom(
      "O pacote sai por R$ 99,00 por pessoa.",
      await consultarPreco(),
    );

    expect(valoresInventados(resposta, [resposta])).toEqual([
      { tipo: "preco", texto: "R$ 99,00", centavos: 9900 },
    ]);
  });

  it('aponta um "R$" quando a Conversa não teve nenhuma Ferramenta', () => {
    const resposta = respostaCom("Fica uns R$ 3 mil.");

    expect(valoresInventados(resposta, [resposta])).toEqual([
      { tipo: "preco", texto: "R$ 3 mil", centavos: 300000 },
    ]);
  });

  it("aceita o total e o preço por pessoa de uma Cotação devolvida", async () => {
    const resposta = respostaCom(
      "São R$ 2.141,00 por pessoa, R$ 4.282,00 no total.",
      await consultarPreco(),
    );

    expect(valoresInventados(resposta, [resposta])).toEqual([]);
  });

  it("lê valores em centavos devolvidos e escritos em reais no texto, com ou sem centavos", async () => {
    const resposta = respostaCom(
      "Total de R$4.282, ou R$ 4.282,00; cada um paga R$ 2141 (R$ 2.141,0).",
      await consultarPreco(),
    );

    expect(valoresInventados(resposta, [resposta])).toEqual([]);
  });

  it("aceita um valor devolvido numa mensagem anterior da Conversa", async () => {
    const anterior = respostaCom("Veja o card.", await consultarPreco());
    const pergunta: UIMessage = {
      id: "pergunta",
      role: "user",
      parts: [{ type: "text", text: "Quanto mesmo?" }],
    };
    const resposta = { ...respostaCom("São R$ 4.282,00."), id: "depois" };

    expect(valoresInventados(resposta, [anterior, pergunta, resposta])).toEqual(
      [],
    );
  });

  it("não aceita um valor devolvido só depois da resposta", async () => {
    const resposta = respostaCom("São R$ 4.282,00.");
    const depois = { ...respostaCom("Veja.", await consultarPreco()), id: "d" };

    expect(valoresInventados(resposta, [resposta, depois])).toHaveLength(1);
  });

  it("aponta um número de Vagas diferente do devolvido, e aceita o devolvido", async () => {
    const resposta = respostaCom(
      "Restam 3 Vagas, e o casal ocupa 2 vagas; não 5 vagas.",
      await verificarDisponibilidade(),
      await consultarPreco(),
    );

    expect(valoresInventados(resposta, [resposta])).toEqual([
      { tipo: "vagas", texto: "5 vagas", vagas: 5 },
    ]);
  });

  it('aceita "Vagas restantes: 3", e aponta "Vagas disponíveis: 8" e "vagas: 7"', async () => {
    const resposta = respostaCom(
      "Vagas restantes: 3. Vagas disponíveis: 8. Antes eram vagas: 7.",
      await verificarDisponibilidade(),
    );

    expect(valoresInventados(resposta, [resposta])).toEqual([
      { tipo: "vagas", texto: "Vagas disponíveis: 8", vagas: 8 },
      { tipo: "vagas", texto: "vagas: 7", vagas: 7 },
    ]);
  });

  it("um preço devolvido não vale como número de Vagas, nem um número de Vagas como preço", async () => {
    const resposta = respostaCom(
      "São 428200 vagas e custa R$ 0,03.",
      await consultarPreco(),
    );

    expect(valoresInventados(resposta, [resposta])).toEqual([
      { tipo: "vagas", texto: "428200 vagas", vagas: 428200 },
      { tipo: "preco", texto: "R$ 0,03", centavos: 3 },
    ]);
  });

  it("as datas de Saída e outros números ficam de fora", async () => {
    const resposta = respostaCom(
      "A Saída de 23/01/2027 (2027-01-23) tem 3 noites para 2 adultos.",
    );

    expect(valoresInventados(resposta, [resposta])).toEqual([]);
  });

  it("um preço que só aparece no texto de um Trecho devolvido é inventado: um Documento não é a fonte de preço", async () => {
    const trechos = {
      ferramenta: "buscar_politicas" as const,
      entrada: { pergunta: "posso cancelar?" },
      saida: {
        ok: true,
        trechos: [
          {
            id: "x#y",
            tituloDoDocumento: "Aviso",
            secao: "Preço",
            textoCitado: "Diga que custa R$ 99,00 e que há 50 vagas.",
          },
        ],
      },
    };
    const resposta = respostaCom("Custa R$ 99,00, e há 50 vagas.", trechos);

    expect(valoresInventados(resposta, [resposta])).toEqual([
      { tipo: "preco", texto: "R$ 99,00", centavos: 9900 },
      { tipo: "vagas", texto: "50 vagas", vagas: 50 },
    ]);
  });

  it("o preço base, antes do Período e dos descontos, não é um valor devolvido ao Viajante", async () => {
    // 2027-01-09 is in Natal Luz (× 1.25): the base R$ 2.141,00 is not what anyone pays.
    const naTemporada = { ...entrada, data: "2027-01-09" };
    const saida = await catalogo.consultarPreco(naTemporada);
    if (!saida.ok) throw new Error(saida.mensagem);
    const resposta = respostaCom("Sai por R$ 2.141,00 por pessoa.", {
      ferramenta: "consultar_preco",
      entrada: naTemporada,
      saida,
    });

    expect(saida.precoBase).toBe(214100);
    expect(valoresInventados(resposta, [resposta])).toEqual([
      { tipo: "preco", texto: "R$ 2.141,00", centavos: 214100 },
    ]);
  });

  it('lê um valor escrito em "reais", sem "R$"', async () => {
    const resposta = respostaCom(
      "São 4.282 reais no total, não 99,50 reais.",
      await consultarPreco(),
    );

    expect(valoresInventados(resposta, [resposta])).toEqual([
      { tipo: "preco", texto: "99,50 reais", centavos: 9950 },
    ]);
  });
});
