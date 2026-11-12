import { describe, expect, it } from "vitest";
import { criarBaseEmMemoria, criarCatalogo, relogioFixo, semente } from ".";

const HOJE = "2026-12-01T09:00:00-03:00";

function catalogoEm(instante: string) {
  return criarCatalogo({
    base: criarBaseEmMemoria(semente),
    relogio: relogioFixo(instante),
  });
}

describe("verificarDisponibilidade", () => {
  it("devolve as Vagas totais e restantes de uma Saída existente", async () => {
    const catalogo = catalogoEm(HOJE);

    const resultado = await catalogo.verificarDisponibilidade({
      pacote: "gramado-serra-azul-3n",
      data: "2027-01-09",
    });

    expect(resultado).toEqual({
      ok: true,
      pacote: "gramado-serra-azul-3n",
      data: "2027-01-09",
      vagasTotais: 20,
      vagasRestantes: 20,
    });
  });

  it("recusa um Pacote que não existe com PACOTE_DESCONHECIDO", async () => {
    const resultado = await catalogoEm(HOJE).verificarDisponibilidade({
      pacote: "gramado-castelo-encantado-3n",
      data: "2027-01-09",
    });

    expect(resultado).toMatchObject({ ok: false, erro: "PACOTE_DESCONHECIDO" });
    expect(resultado.ok || resultado.mensagem).toContain(
      "gramado-castelo-encantado-3n",
    );
  });

  it("recusa uma data que não é Saída com SAIDA_INEXISTENTE e sugere as Saídas mais próximas", async () => {
    const resultado = await catalogoEm(HOJE).verificarDisponibilidade({
      pacote: "gramado-serra-azul-3n",
      data: "2027-01-20",
    });

    expect(resultado).toMatchObject({
      ok: false,
      erro: "SAIDA_INEXISTENTE",
      sugestoes: ["2027-01-16", "2027-01-23", "2027-01-30"],
    });
  });

  it("não sugere Saídas que já passaram", async () => {
    const resultado = await catalogoEm(
      "2027-01-25T09:00:00-03:00",
    ).verificarDisponibilidade({
      pacote: "gramado-serra-azul-3n",
      data: "2027-01-20",
    });

    expect(resultado).toMatchObject({
      ok: false,
      erro: "SAIDA_INEXISTENTE",
      sugestoes: ["2027-01-30", "2027-02-06"],
    });
  });

  it("recusa uma Saída no passado com SAIDA_ENCERRADA", async () => {
    const resultado = await catalogoEm(
      "2027-01-10T09:00:00-03:00",
    ).verificarDisponibilidade({
      pacote: "gramado-serra-azul-3n",
      data: "2027-01-09",
    });

    expect(resultado).toMatchObject({
      ok: false,
      erro: "SAIDA_ENCERRADA",
      sugestoes: ["2027-01-16", "2027-01-23", "2027-01-30"],
    });
  });

  it("decide o que é passado pela data de São Paulo, não pela de UTC", async () => {
    // 23h of Jan 9th in São Paulo is already Jan 10th in UTC.
    const resultado = await catalogoEm(
      "2027-01-09T23:00:00-03:00",
    ).verificarDisponibilidade({
      pacote: "gramado-serra-azul-3n",
      data: "2027-01-09",
    });

    expect(resultado).toMatchObject({ ok: true, vagasRestantes: 20 });
  });

  it.each([
    { caso: "data no formato brasileiro", data: "09/01/2027" },
    { caso: "data que não existe no calendário", data: "2027-02-30" },
    { caso: "data com hora", data: "2027-01-09T10:00:00" },
  ])(
    "recusa $caso com ENTRADA_INVALIDA, apontando o campo",
    async ({ data }) => {
      const resultado = await catalogoEm(HOJE).verificarDisponibilidade({
        pacote: "gramado-serra-azul-3n",
        data,
      });

      expect(resultado).toMatchObject({ ok: false, erro: "ENTRADA_INVALIDA" });
      expect(resultado.ok || resultado.mensagem).toContain("data");
    },
  );

  it("recusa entrada sem o Pacote com ENTRADA_INVALIDA em vez de lançar exceção", async () => {
    const resultado = await catalogoEm(HOJE).verificarDisponibilidade({
      data: "2027-01-09",
    } as never);

    expect(resultado).toMatchObject({ ok: false, erro: "ENTRADA_INVALIDA" });
    expect(resultado.ok || resultado.mensagem).toContain("pacote");
  });
});
