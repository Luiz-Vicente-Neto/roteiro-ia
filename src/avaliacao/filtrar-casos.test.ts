import { describe, expect, it } from "vitest";
import type { Casos } from "./caso";
import { filtrarCasos } from "./filtrar-casos";

const casos: Casos = {
  agora: "2026-12-01T09:00:00-03:00",
  lista: [
    {
      id: "fora-do-escopo-poema",
      categoria: "fora-do-escopo",
      mensagem: "Escreva um poema.",
    },
    {
      id: "nao-sei-cambio",
      categoria: "nao-sei",
      mensagem: "Onde troco dinheiro?",
      assunto: ["câmbio"],
    },
    {
      id: "fora-do-escopo-receita",
      categoria: "fora-do-escopo",
      mensagem: "Uma receita de bolo?",
    },
  ],
};

describe("filtrarCasos", () => {
  it("sem filtro, mantém todos os Casos", () => {
    expect(filtrarCasos(casos, {})).toEqual(casos);
  });

  it("--categoria mantém só os Casos dela, na ordem, com o mesmo instante", () => {
    expect(filtrarCasos(casos, { categoria: "fora-do-escopo" })).toEqual({
      agora: casos.agora,
      lista: [casos.lista[0], casos.lista[2]],
    });
  });

  it("--caso mantém só aquele Caso", () => {
    expect(
      filtrarCasos(casos, { caso: "nao-sei-cambio" }).lista.map((c) => c.id),
    ).toEqual(["nao-sei-cambio"]);
  });

  it("recusa uma categoria ou um Caso que não existe, dizendo os que existem", () => {
    expect(() => filtrarCasos(casos, { categoria: "precos" })).toThrow(
      /precos.*preco, citacao, injection, nao-sei, fora-do-escopo/,
    );
    expect(() => filtrarCasos(casos, { caso: "nao-existe" })).toThrow(
      /nao-existe/,
    );
  });

  it("recusa uma categoria sem nenhum Caso", () => {
    expect(() => filtrarCasos(casos, { categoria: "preco" })).toThrow(
      "Nenhum Caso da categoria preco.",
    );
  });

  it("recusa --categoria e --caso juntos que não se cruzam", () => {
    expect(() =>
      filtrarCasos(casos, {
        categoria: "nao-sei",
        caso: "fora-do-escopo-poema",
      }),
    ).toThrow(
      "O Caso fora-do-escopo-poema não é da categoria nao-sei: nenhum Caso para rodar.",
    );
  });
});
