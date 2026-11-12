import { describe, expect, it } from "vitest";
import { criarBaseEmMemoria, criarCatalogo, relogioFixo } from ".";
import { catalogoDeTeste } from "./catalogo-de-teste";

const catalogo = criarCatalogo({
  base: criarBaseEmMemoria(catalogoDeTeste),
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

  it("expõe consultar_preco com descrição para o modelo e schema de entrada", () => {
    const consultar = ferramenta("consultar_preco");

    expect(consultar.descricao).toMatch(/Cotação/);
    expect(
      consultar.schemaDeEntrada.safeParse({
        pacote: "x",
        data: "2027-01-09",
        grupo: { adultos: 2, criancas: [] },
      }).success,
    ).toBe(true);
    expect(
      consultar.schemaDeEntrada.safeParse({ pacote: "x", data: "2027-01-09" })
        .success,
    ).toBe(false);
  });

  it.each([
    {
      pacote: "gramado-serra-azul-3n",
      data: "2027-01-09",
      grupo: { adultos: 2 },
    },
    {
      pacote: "gramado-serra-azul-5n",
      data: "2027-02-07",
      grupo: { adultos: 1 },
    },
    {
      pacote: "gramado-serra-azul-3n",
      data: "2027-01-20",
      grupo: { adultos: 2 },
    },
    {
      pacote: "gramado-serra-azul-3n",
      data: "2027-01-09",
      grupo: { adultos: 0 },
    },
  ])(
    "executar consultar_preco dá o mesmo resultado que a operação direta ($pacote, $data)",
    async (entrada) => {
      expect(await ferramenta("consultar_preco").executar(entrada)).toEqual(
        await catalogo.consultarPreco(entrada),
      );
    },
  );

  it("executar com entrada que não é um objeto devolve ENTRADA_INVALIDA em vez de lançar exceção", async () => {
    expect(
      await ferramenta("verificar_disponibilidade").executar("gramado"),
    ).toMatchObject({ ok: false, erro: "ENTRADA_INVALIDA" });
  });
});
