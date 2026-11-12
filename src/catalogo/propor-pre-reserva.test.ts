import { describe, expect, it } from "vitest";
import { criarBaseEmMemoria, criarCatalogo, relogioFixo } from ".";
import { catalogoDeTeste } from "./catalogo-de-teste";

const AGORA = "2026-12-01T09:00:00-03:00";

function montar() {
  const base = criarBaseEmMemoria(catalogoDeTeste);
  const catalogo = criarCatalogo({ base, relogio: relogioFixo(AGORA) });
  return { base, catalogo };
}

const casal = {
  pacote: "gramado-serra-azul-3n",
  data: "2027-01-30",
  grupo: { adultos: 2 },
};

describe("proporPreReserva", () => {
  it("devolve uma Proposta com id, a Cotação da Saída para o Grupo e a expiração em agora + 15 minutos", async () => {
    const { catalogo } = montar();

    const proposta = await catalogo.proporPreReserva(casal);

    if (!proposta.ok) throw new Error(proposta.mensagem);
    expect(proposta.id).toEqual(expect.any(String));
    expect(proposta.expiraEm).toBe("2026-12-01T12:15:00.000Z");
    const { ok, ...cotacao } = await catalogo.consultarPreco(casal);
    expect(ok).toBe(true);
    expect(proposta.cotacao).toEqual(cotacao);
    expect(proposta.cotacao.total).toBe(428200);
  });

  it("grava a Proposta na Base do Catálogo, com a Saída, o Grupo, o total e os instantes de criação e expiração", async () => {
    const { base, catalogo } = montar();

    const proposta = await catalogo.proporPreReserva({
      pacote: "gramado-serra-azul-5n",
      data: "2027-02-07",
      grupo: { adultos: 2, criancas: [8, 1] },
    });

    if (!proposta.ok) throw new Error(proposta.mensagem);
    expect(await base.lerProposta(proposta.id)).toEqual({
      id: proposta.id,
      pacote: "gramado-serra-azul-5n",
      data: "2027-02-07",
      grupo: { adultos: 2, criancas: [8, 1] },
      total: proposta.cotacao.total,
      criadaEm: new Date("2026-12-01T12:00:00.000Z"),
      expiraEm: new Date("2026-12-01T12:15:00.000Z"),
    });
  });

  it("recusa com VAGAS_INSUFICIENTES um Grupo maior que as Vagas restantes, contando crianças, e sugere as Saídas mais próximas que cabem o Grupo", async () => {
    const { catalogo } = montar();

    // 2027-01-23 has 3 Vagas; a 4-year-old pays nothing but still takes one.
    const resultado = await catalogo.proporPreReserva({
      pacote: "gramado-serra-azul-3n",
      data: "2027-01-23",
      grupo: { adultos: 2, criancas: [4, 8] },
    });

    expect(resultado).toEqual({
      ok: false,
      erro: "VAGAS_INSUFICIENTES",
      mensagem: expect.stringMatching(/3 Vagas.*4 pessoas/),
      sugestoes: ["2027-01-09", "2027-01-16", "2027-01-30"],
    });
  });

  it("aceita um Grupo do tamanho exato das Vagas restantes", async () => {
    const { catalogo } = montar();

    const resultado = await catalogo.proporPreReserva({
      pacote: "gramado-serra-azul-3n",
      data: "2027-01-23",
      grupo: { adultos: 3 },
    });

    expect(resultado.ok).toBe(true);
  });

  it("não bloqueia Vagas: as Vagas restantes da Saída continuam iguais depois de propor", async () => {
    const { catalogo } = montar();
    const saida = { pacote: casal.pacote, data: casal.data };
    const antes = await catalogo.verificarDisponibilidade(saida);

    await catalogo.proporPreReserva(casal);
    await catalogo.proporPreReserva(casal);

    expect(await catalogo.verificarDisponibilidade(saida)).toEqual(antes);
    expect(antes).toMatchObject({ ok: true, vagasRestantes: 20 });
  });

  it.each([
    {
      caso: "Pacote desconhecido",
      erro: "PACOTE_DESCONHECIDO",
      entrada: { ...casal, pacote: "nao-existe" },
    },
    {
      caso: "data que não é Saída",
      erro: "SAIDA_INEXISTENTE",
      entrada: { ...casal, data: "2027-01-20" },
    },
    {
      caso: "Saída no passado",
      erro: "SAIDA_ENCERRADA",
      entrada: { ...casal, data: "2027-01-09" },
      agora: "2027-01-10T09:00:00-03:00",
    },
    {
      caso: "Grupo com criança num Pacote que não aceita crianças",
      erro: "GRUPO_NAO_ACEITO",
      entrada: {
        pacote: "gramado-vale-das-hortensias-4n",
        data: "2027-01-14",
        grupo: { adultos: 2, criancas: [7] },
      },
    },
    {
      caso: "entrada inválida",
      erro: "ENTRADA_INVALIDA",
      entrada: { ...casal, grupo: { adultos: 0 } },
    },
  ])(
    "devolve o mesmo erro que consultarPreco ($erro, $caso)",
    async ({ erro, entrada, agora = AGORA }) => {
      const catalogo = criarCatalogo({
        base: criarBaseEmMemoria(catalogoDeTeste),
        relogio: relogioFixo(agora),
      });

      const resultado = await catalogo.proporPreReserva(entrada);

      expect(resultado).toMatchObject({ ok: false, erro });
      expect(resultado).toEqual(await catalogo.consultarPreco(entrada));
    },
  );

  it("gera ids longos e aleatórios: nenhum se repete e nenhum é previsível a partir do anterior", async () => {
    const { catalogo } = montar();

    const ids: string[] = [];
    for (let i = 0; i < 50; i++) {
      const proposta = await catalogo.proporPreReserva(casal);
      if (!proposta.ok) throw new Error(proposta.mensagem);
      ids.push(proposta.id);
    }

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{64}$/);
    // A sequential id would differ from the previous one only at the end;
    // random ones differ almost everywhere.
    const [primeiro, segundo] = ids;
    const iguais = [...primeiro].filter((c, i) => c === segundo[i]).length;
    expect(iguais).toBeLessThan(16);
  });
});
