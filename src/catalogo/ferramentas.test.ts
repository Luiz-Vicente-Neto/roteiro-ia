import { describe, expect, it } from "vitest";
import { criarBaseEmMemoria, criarCatalogo, relogioFixo, semente } from ".";

const catalogo = criarCatalogo({
  base: criarBaseEmMemoria(semente),
  relogio: relogioFixo("2026-12-01T09:00:00-03:00"),
});

function ferramenta(nome: string) {
  const encontrada = catalogo.ferramentas.find((f) => f.nome === nome);
  if (!encontrada) throw new Error(`Ferramenta ${nome} não está na lista`);
  return encontrada;
}

describe("ferramentas", () => {
  it("expõe verificar_disponibilidade com descrição para o modelo e schema de entrada", () => {
    const verificar = ferramenta("verificar_disponibilidade");

    expect(verificar.descricao).toMatch(/Vagas/);
    expect(
      verificar.schemaDeEntrada.safeParse({ pacote: "x", data: "2027-01-09" })
        .success,
    ).toBe(true);
    expect(verificar.schemaDeEntrada.safeParse({ pacote: "x" }).success).toBe(
      false,
    );
  });

  it.each([
    { pacote: "gramado-serra-azul-3n", data: "2027-01-09" },
    { pacote: "gramado-serra-azul-3n", data: "2027-01-20" },
    { pacote: "nao-existe", data: "2027-01-09" },
    { pacote: "gramado-serra-azul-3n", data: "09/01/2027" },
  ])(
    "executar verificar_disponibilidade dá o mesmo resultado que a operação direta ($pacote, $data)",
    async (entrada) => {
      expect(
        await ferramenta("verificar_disponibilidade").executar(entrada),
      ).toEqual(await catalogo.verificarDisponibilidade(entrada));
    },
  );

  it("executar com entrada que não é um objeto devolve ENTRADA_INVALIDA em vez de lançar exceção", async () => {
    expect(
      await ferramenta("verificar_disponibilidade").executar("gramado"),
    ).toMatchObject({ ok: false, erro: "ENTRADA_INVALIDA" });
  });
});
