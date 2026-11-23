import { describe, expect, it } from "vitest";
import { resolverLimites } from "./limitador";

describe("resolverLimites", () => {
  it("sem as variáveis, usa 10 por IP por hora e o teto global padrão", () => {
    expect(resolverLimites({})).toEqual({
      porOrigemPorHora: 10,
      globalPorDia: 7,
    });
  });

  it("lê LIMITE_POR_IP_HORA e LIMITE_GLOBAL_DIA", () => {
    expect(
      resolverLimites({ LIMITE_POR_IP_HORA: "3", LIMITE_GLOBAL_DIA: "250" }),
    ).toEqual({ porOrigemPorHora: 3, globalPorDia: 250 });
  });

  it.each(["0", "-1", "2.5", "dez", " "])(
    "recusa %j, dizendo qual variável está errada",
    (valor) => {
      expect(() => resolverLimites({ LIMITE_GLOBAL_DIA: valor })).toThrow(
        /LIMITE_GLOBAL_DIA/,
      );
    },
  );
});
