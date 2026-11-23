import { describe, expect, it } from "vitest";
import { criarBaseEmMemoria, criarCatalogo, relogioFixo } from "../catalogo";
import { catalogoDeTeste } from "../catalogo/catalogo-de-teste";
import { buscaNosTextosDeTeste } from "../catalogo/textos-de-teste";
import { instrucoes } from "./instrucoes";

const catalogo = criarCatalogo({
  ...buscaNosTextosDeTeste(),
  base: criarBaseEmMemoria(catalogoDeTeste),
  relogio: relogioFixo("2026-12-01T09:00:00-03:00"),
});

describe("instrucoes", () => {
  it("só manda chamar Ferramentas que existem, para que renomear uma não deixe o prompt com o nome antigo", () => {
    const existentes = catalogo.ferramentas.map((f) => f.nome);
    const citadas = new Set(
      instrucoes("2026-12-01").match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? [],
    );

    expect(citadas.size).toBeGreaterThan(0);
    for (const nome of citadas) expect(existentes).toContain(nome);
  });
});
