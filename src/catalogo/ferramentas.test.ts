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

  it("expõe buscar_pacotes dizendo que o orçamento é total e o grupo é obrigatório", () => {
    const buscar = ferramenta("buscar_pacotes");

    expect(buscar.descricao).toMatch(/total do Grupo/i);
    expect(buscar.descricao).toMatch(/grupo.*obrigatório/i);
    expect(
      buscar.schemaDeEntrada.safeParse({ grupo: { adultos: 2 } }).success,
    ).toBe(true);
    expect(
      buscar.schemaDeEntrada.safeParse({ destino: "Gramado" }).success,
    ).toBe(false);
  });

  it.each([
    {
      destino: "gramado",
      janela: { inicio: "2027-01-01", fim: "2027-01-31" },
      grupo: { adultos: 2 },
      orcamento: 600000,
    },
    { destino: "Bonito", grupo: { adultos: 2 } },
    { grupo: { adultos: 2 }, orcamento: 100 },
    { destino: "Gramado" },
  ])(
    "executar buscar_pacotes dá o mesmo resultado que a operação direta (%o)",
    async (entrada) => {
      expect(await ferramenta("buscar_pacotes").executar(entrada)).toEqual(
        await catalogo.buscarPacotes(entrada as never),
      );
    },
  );

  it("executar com entrada que não é um objeto devolve ENTRADA_INVALIDA em vez de lançar exceção", async () => {
    expect(
      await ferramenta("verificar_disponibilidade").executar("gramado"),
    ).toMatchObject({ ok: false, erro: "ENTRADA_INVALIDA" });
  });
});
