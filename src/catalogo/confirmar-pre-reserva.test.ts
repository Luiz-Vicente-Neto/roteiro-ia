import { describe, expect, it } from "vitest";
import {
  type BaseDoCatalogo,
  criarBaseEmMemoria,
  criarCatalogo,
  relogioFixo,
} from ".";
import { catalogoDeTeste } from "./catalogo-de-teste";

const AGORA = "2026-12-01T09:00:00-03:00";

/** The same Base seen at another instant, as if the clock had moved on. */
function catalogoEm(base: BaseDoCatalogo, instante: string) {
  return criarCatalogo({ base, relogio: relogioFixo(instante) });
}

function montar(base = criarBaseEmMemoria(catalogoDeTeste)) {
  return { base, catalogo: catalogoEm(base, AGORA) };
}

const casal = {
  pacote: "gramado-serra-azul-3n",
  data: "2027-01-30",
  grupo: { adultos: 2 },
};

async function propor(
  catalogo: ReturnType<typeof criarCatalogo>,
  entrada: Parameters<ReturnType<typeof criarCatalogo>["proporPreReserva"]>[0],
) {
  const proposta = await catalogo.proporPreReserva(entrada);
  if (!proposta.ok) throw new Error(proposta.mensagem);
  return proposta;
}

describe("confirmarPreReserva", () => {
  it("cria uma Pré-reserva com código RT-XXXX, a Saída, o Grupo, o total e a expiração em criação + 24 h", async () => {
    const { catalogo } = montar();
    const proposta = await propor(catalogo, casal);

    const resultado = await catalogo.confirmarPreReserva(proposta.id);

    expect(resultado).toEqual({
      ok: true,
      preReserva: {
        codigo: expect.stringMatching(/^RT-[A-Z2-9]{4}$/),
        pacote: "gramado-serra-azul-3n",
        data: "2027-01-30",
        grupo: { adultos: 2, criancas: [] },
        total: 428200,
        criadaEm: "2026-12-01T12:00:00.000Z",
        expiraEm: "2026-12-02T12:00:00.000Z",
      },
    });
  });

  it("bloqueia as Vagas: as Vagas restantes da Saída diminuem no tamanho do Grupo, contando crianças", async () => {
    const { catalogo } = montar();
    const proposta = await propor(catalogo, {
      ...casal,
      grupo: { adultos: 2, criancas: [3, 9] },
    });

    await catalogo.confirmarPreReserva(proposta.id);

    expect(
      await catalogo.verificarDisponibilidade({
        pacote: casal.pacote,
        data: casal.data,
      }),
    ).toMatchObject({ ok: true, vagasTotais: 20, vagasRestantes: 16 });
  });

  it("recusa confirmar a mesma Proposta de novo com PROPOSTA_JA_CONFIRMADA, sem bloquear mais Vagas", async () => {
    const { catalogo } = montar();
    const proposta = await propor(catalogo, casal);
    await catalogo.confirmarPreReserva(proposta.id);

    const deNovo = await catalogo.confirmarPreReserva(proposta.id);

    expect(deNovo).toMatchObject({ ok: false, erro: "PROPOSTA_JA_CONFIRMADA" });
    expect(
      await catalogo.verificarDisponibilidade({
        pacote: casal.pacote,
        data: casal.data,
      }),
    ).toMatchObject({ vagasRestantes: 18 });
  });

  it("recusa com PROPOSTA_EXPIRADA uma Proposta confirmada 15 minutos depois de feita", async () => {
    const { base, catalogo } = montar();
    const proposta = await propor(catalogo, casal);

    const resultado = await catalogoEm(
      base,
      "2026-12-01T09:15:00-03:00",
    ).confirmarPreReserva(proposta.id);

    expect(resultado).toMatchObject({ ok: false, erro: "PROPOSTA_EXPIRADA" });
  });

  it("aceita uma Proposta confirmada um instante antes de expirar", async () => {
    const { base, catalogo } = montar();
    const proposta = await propor(catalogo, casal);

    const resultado = await catalogoEm(
      base,
      "2026-12-01T09:14:59.999-03:00",
    ).confirmarPreReserva(proposta.id);

    expect(resultado.ok).toBe(true);
  });

  it("recusa com PROPOSTA_INEXISTENTE um id que nunca foi proposto", async () => {
    const { catalogo } = montar();

    expect(await catalogo.confirmarPreReserva("f0".repeat(32))).toMatchObject({
      ok: false,
      erro: "PROPOSTA_INEXISTENTE",
    });
  });

  it("recusa com VAGAS_INSUFICIENTES quando as Vagas acabaram entre propor e confirmar", async () => {
    const { catalogo } = montar();
    // 2027-01-23 has 3 Vagas: both fit when proposed, only the first is confirmed.
    const saida = { pacote: "gramado-serra-azul-3n", data: "2027-01-23" };
    const primeira = await propor(catalogo, {
      ...saida,
      grupo: { adultos: 2 },
    });
    const segunda = await propor(catalogo, { ...saida, grupo: { adultos: 2 } });
    await catalogo.confirmarPreReserva(primeira.id);

    const resultado = await catalogo.confirmarPreReserva(segunda.id);

    expect(resultado).toEqual({
      ok: false,
      erro: "VAGAS_INSUFICIENTES",
      mensagem: expect.stringMatching(/1 Vagas.*2 pessoas/),
    });
    expect(await catalogo.verificarDisponibilidade(saida)).toMatchObject({
      vagasRestantes: 1,
    });
  });

  it("recusa com PRECO_ALTERADO quando o preço recalculado difere do da Proposta, sem bloquear Vagas", async () => {
    const original = criarBaseEmMemoria(catalogoDeTeste);
    let precoBase: number | undefined;
    // The same Base, but the catalog can be repriced between the two phases.
    const base: BaseDoCatalogo = {
      ...original,
      async lerCatalogo() {
        const dados = await original.lerCatalogo();
        const novo = precoBase;
        if (novo === undefined) return dados;
        return {
          ...dados,
          pacotes: dados.pacotes.map((p) => ({ ...p, precoBase: novo })),
        };
      },
    };
    const { catalogo } = montar(base);
    const proposta = await propor(catalogo, casal);
    precoBase = 250000;

    const resultado = await catalogo.confirmarPreReserva(proposta.id);

    expect(resultado).toMatchObject({ ok: false, erro: "PRECO_ALTERADO" });
    expect(
      await catalogo.verificarDisponibilidade({
        pacote: casal.pacote,
        data: casal.data,
      }),
    ).toMatchObject({ vagasRestantes: 20 });
  });

  it("deixa de contar a Pré-reserva 24 h depois de criada: as Vagas voltam", async () => {
    const { base, catalogo } = montar();
    const saida = { pacote: casal.pacote, data: casal.data };
    const proposta = await propor(catalogo, casal);
    await catalogo.confirmarPreReserva(proposta.id);

    const quaseUmDia = catalogoEm(base, "2026-12-02T08:59:59.999-03:00");
    const umDiaDepois = catalogoEm(base, "2026-12-02T09:00:00-03:00");

    expect(await quaseUmDia.verificarDisponibilidade(saida)).toMatchObject({
      vagasRestantes: 18,
    });
    expect(await umDiaDepois.verificarDisponibilidade(saida)).toMatchObject({
      vagasRestantes: 20,
    });
  });

  it("consultar_preco e buscar_pacotes refletem as Pré-reservas ativas", async () => {
    const { catalogo } = montar();
    const saida = { pacote: "gramado-serra-azul-3n", data: "2027-01-23" };
    const proposta = await propor(catalogo, {
      ...saida,
      grupo: { adultos: 3 },
    });
    await catalogo.confirmarPreReserva(proposta.id);

    expect(
      await catalogo.consultarPreco({ ...saida, grupo: { adultos: 1 } }),
    ).toMatchObject({ ok: true, vagasRestantes: 0 });
    const busca = await catalogo.buscarPacotes({
      destino: "Gramado",
      janela: { inicio: saida.data, fim: saida.data },
      grupo: { adultos: 1 },
    });
    expect(busca).toMatchObject({
      ok: true,
      cotacoes: [],
      diagnostico: { saidasNaJanela: 1, semVagas: 1 },
    });
  });

  it("não guarda nenhum dado pessoal na Pré-reserva", async () => {
    const { catalogo } = montar();
    const proposta = await propor(catalogo, casal);

    const resultado = await catalogo.confirmarPreReserva(proposta.id);

    if (!resultado.ok) throw new Error(resultado.mensagem);
    expect(Object.keys(resultado.preReserva).sort()).toEqual([
      "codigo",
      "criadaEm",
      "data",
      "expiraEm",
      "grupo",
      "pacote",
      "total",
    ]);
  });
});
