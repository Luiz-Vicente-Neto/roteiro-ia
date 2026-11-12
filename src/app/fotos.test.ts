import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { semente } from "../catalogo";
import { fotoDoDestino } from "./fotos";

describe("fotoDoDestino", () => {
  it.each(semente.destinos)(
    "$nome tem foto local, com autor e link para o crédito",
    ({ slug }) => {
      const foto = fotoDoDestino(slug);

      expect(foto).toBeDefined();
      expect(existsSync(join("public", foto?.src ?? "-"))).toBe(true);
      expect(foto?.autor).toMatch(/\S/);
      expect(foto?.link).toMatch(/^https:\/\/unsplash\.com\/@/);
    },
  );

  it("não tem foto para um Destino que não está no catálogo", () => {
    expect(fotoDoDestino("atlantida")).toBeUndefined();
  });
});
