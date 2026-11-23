import { describe, expect, it } from "vitest";
import type { Limitador } from "./limitador";

/** Builds a Limitador, maybe shared between cases: each case uses fresh chaves. */
export type CriarLimitador = () => Promise<Limitador>;

const janela = new Date("2026-12-01T12:00:00.000Z");

/** The same cases run against every Limitador implementation. */
export function testarContratoDoLimitador(nome: string, criar: CriarLimitador) {
  describe(`Limitador (${nome})`, () => {
    it("conta as mensagens de uma chave na mesma janela, uma a uma", async () => {
      const limitador = await criar();
      const chave = crypto.randomUUID();

      expect(await limitador.contar(chave, janela)).toBe(1);
      expect(await limitador.contar(chave, janela)).toBe(2);
      expect(await limitador.contar(chave, new Date(janela))).toBe(3);
    });

    it("conta cada chave à parte", async () => {
      const limitador = await criar();
      const uma = crypto.randomUUID();
      const outra = crypto.randomUUID();

      await limitador.contar(uma, janela);
      await limitador.contar(uma, janela);

      expect(await limitador.contar(outra, janela)).toBe(1);
      expect(await limitador.contar(uma, janela)).toBe(3);
    });

    it("recomeça a contagem numa janela nova, sem mudar a anterior", async () => {
      const limitador = await criar();
      const chave = crypto.randomUUID();
      const seguinte = new Date(janela.getTime() + 60 * 60 * 1000);

      await limitador.contar(chave, janela);
      await limitador.contar(chave, janela);

      expect(await limitador.contar(chave, seguinte)).toBe(1);
      expect(await limitador.contar(chave, janela)).toBe(3);
    });

    it("não perde nenhuma de várias contagens ao mesmo tempo", async () => {
      const limitador = await criar();
      const chave = crypto.randomUUID();

      const contagens = await Promise.all(
        Array.from({ length: 20 }, () => limitador.contar(chave, janela)),
      );

      expect(contagens.toSorted((a, b) => a - b)).toEqual(
        Array.from({ length: 20 }, (_, i) => i + 1),
      );
    });
  });
}
