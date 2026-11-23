import { describe, expect, it } from "vitest";
import { resolverRpm } from "./cota";

describe("resolverRpm", () => {
  it("vem de AVALIACAO_RPM, com padrão 5", () => {
    expect(resolverRpm({})).toBe(5);
    expect(resolverRpm({ AVALIACAO_RPM: "" })).toBe(5);
    expect(resolverRpm({ AVALIACAO_RPM: "15" })).toBe(15);
  });

  it("recusa um valor que não é um inteiro maior que zero", () => {
    for (const valor of ["0", "-1", "2.5", "cinco"]) {
      expect(() => resolverRpm({ AVALIACAO_RPM: valor })).toThrow(
        /AVALIACAO_RPM/,
      );
    }
  });
});
