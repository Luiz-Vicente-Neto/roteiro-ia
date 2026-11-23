import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { Caso } from "./caso";
import {
  type ContextoDaAvaliacao,
  impressaoDigital,
} from "./impressao-digital";

const caso: Caso = {
  id: "fora-do-escopo-poema",
  categoria: "fora-do-escopo",
  mensagem: "Escreva um poema.",
};
const schemaDeEntrada = z.toJSONSchema(z.object({}), { io: "input" });
const contexto: ContextoDaAvaliacao = {
  oQueOModeloRecebe: {
    instrucoes: "Você é o Assistente.",
    ferramentas: [
      {
        nome: "buscar_pacotes",
        descricao: "Busca Pacotes.",
        schemaDeEntrada,
      },
    ],
  },
  semente: { destinos: [] } as unknown as ContextoDaAvaliacao["semente"],
  trechos: [{ id: "politica-da-agencia#cancelamento", hash: "aaa" }],
};
const base = {
  modelo: "google:gemini-3.8-flash",
  juiz: null,
  caso,
  agora: "2026-12-01T09:00:00-03:00",
  contexto,
};

describe("impressaoDigital", () => {
  it("é a mesma para as mesmas entradas", () => {
    expect(impressaoDigital(base)).toBe(impressaoDigital({ ...base }));
    expect(impressaoDigital(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("muda com o prompt de sistema, uma Ferramenta, a semente, um Trecho ou o juiz", () => {
    const mudancas: ContextoDaAvaliacao[] = [
      {
        ...contexto,
        oQueOModeloRecebe: {
          ...contexto.oQueOModeloRecebe,
          instrucoes: "Você é o Assistente. Seja breve.",
        },
      },
      {
        ...contexto,
        oQueOModeloRecebe: {
          ...contexto.oQueOModeloRecebe,
          ferramentas: [
            {
              nome: "buscar_pacotes",
              descricao: "Busca Pacotes do catálogo.",
              schemaDeEntrada,
            },
          ],
        },
      },
      {
        ...contexto,
        semente: { destinos: [1] } as unknown as ContextoDaAvaliacao["semente"],
      },
      {
        ...contexto,
        trechos: [{ id: "politica-da-agencia#cancelamento", hash: "bbb" }],
      },
    ];
    const original = impressaoDigital(base);
    for (const outro of mudancas) {
      expect(impressaoDigital({ ...base, contexto: outro })).not.toBe(original);
    }
    expect(impressaoDigital({ ...base, juiz: "google:outro" })).not.toBe(
      original,
    );
  });
});
