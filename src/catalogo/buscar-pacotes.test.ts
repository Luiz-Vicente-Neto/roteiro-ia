import { describe, expect, it } from "vitest";
import {
  criarBaseEmMemoria,
  criarCatalogo,
  type DadosDoCatalogo,
  type Pacote,
  relogioFixo,
} from ".";

const HOJE = "2026-12-01T09:00:00-03:00";

const metade: Pacote["politicaDeCriancas"] = {
  aceitaCriancas: true,
  faixas: [{ idadeMinima: 0, idadeMaxima: 11, percentual: 50 }],
};

// Two Destinos, one with an accent in the name, and a winter temporada in
// Gramado from mid-July, so some July Saídas cost more than others.
const dados: DadosDoCatalogo = {
  destinos: [
    { slug: "gramado", nome: "Gramado" },
    { slug: "florianopolis", nome: "Florianópolis" },
  ],
  hoteis: [
    {
      slug: "serra-azul",
      nome: "Hotel Serra Azul",
      destino: "gramado",
      aceitaPet: false,
    },
    {
      slug: "lagoa",
      nome: "Pousada da Lagoa",
      destino: "florianopolis",
      aceitaPet: false,
    },
  ],
  pacotes: [
    {
      slug: "gramado-serra-azul-3n",
      nome: "Gramado Essencial",
      hotel: "serra-azul",
      noites: 3,
      inclui: ["Café da manhã"],
      precoBase: 150000,
      politicaDeCriancas: metade,
    },
    {
      slug: "gramado-serra-azul-4n",
      nome: "Gramado Romântico",
      hotel: "serra-azul",
      noites: 4,
      inclui: ["Café da manhã", "Fondue"],
      precoBase: 180000,
      politicaDeCriancas: { aceitaCriancas: false },
    },
    {
      slug: "florianopolis-lagoa-5n",
      nome: "Floripa na Lagoa",
      hotel: "lagoa",
      noites: 5,
      inclui: ["Café da manhã"],
      precoBase: 120000,
      politicaDeCriancas: metade,
    },
  ],
  saidas: [
    { pacote: "gramado-serra-azul-3n", data: "2026-11-21", vagasTotais: 20 },
    { pacote: "gramado-serra-azul-3n", data: "2026-12-05", vagasTotais: 20 },
    { pacote: "gramado-serra-azul-3n", data: "2027-07-03", vagasTotais: 20 },
    { pacote: "gramado-serra-azul-3n", data: "2027-07-10", vagasTotais: 1 },
    { pacote: "gramado-serra-azul-3n", data: "2027-07-17", vagasTotais: 20 },
    { pacote: "gramado-serra-azul-3n", data: "2027-08-07", vagasTotais: 20 },
    { pacote: "gramado-serra-azul-4n", data: "2027-07-05", vagasTotais: 10 },
    { pacote: "gramado-serra-azul-4n", data: "2027-07-19", vagasTotais: 10 },
    { pacote: "florianopolis-lagoa-5n", data: "2027-07-04", vagasTotais: 10 },
    { pacote: "florianopolis-lagoa-5n", data: "2027-12-18", vagasTotais: 10 },
  ],
  periodos: [
    {
      nome: "Alta de Inverno",
      tipo: "temporada",
      destino: "gramado",
      inicio: "2027-07-12",
      fim: "2027-07-31",
      fator: 1.5,
    },
  ],
};

const catalogo = criarCatalogo({
  base: criarBaseEmMemoria(dados),
  relogio: relogioFixo(HOJE),
});

const JULHO = { inicio: "2027-07-01", fim: "2027-07-31" };
const CASAL = { adultos: 2 };

/** The Pacote, date and total of each Cotação, in result order. */
async function resumo(entrada: Parameters<typeof catalogo.buscarPacotes>[0]) {
  const resultado = await catalogo.buscarPacotes(entrada);
  if (!resultado.ok) throw new Error(resultado.mensagem);
  return resultado.cotacoes.map((c) => ({
    pacote: c.pacote.slug,
    data: c.data,
    total: c.total,
    outrasSaidas: c.outrasSaidas,
  }));
}

describe("buscarPacotes", () => {
  it("devolve Cotações só das Saídas que passam em todos os filtros, da mais barata para a mais cara", async () => {
    // Casal em Gramado em julho, até R$ 4.000: the 3n on 07-10 has 1 Vaga and
    // on 07-17 costs R$ 4.500; the 4n on 07-19 costs R$ 5.400.
    expect(
      await resumo({
        destino: "Gramado",
        janela: JULHO,
        grupo: CASAL,
        orcamento: 400000,
      }),
    ).toEqual([
      {
        pacote: "gramado-serra-azul-3n",
        data: "2027-07-03",
        total: 300000,
        outrasSaidas: [],
      },
      {
        pacote: "gramado-serra-azul-4n",
        data: "2027-07-05",
        total: 360000,
        outrasSaidas: [],
      },
    ]);
  });

  it("cada resultado é uma Cotação completa, igual à de consultarPreco, com as outras datas", async () => {
    const resultado = await catalogo.buscarPacotes({
      destino: "gramado",
      janela: JULHO,
      grupo: { adultos: 1, criancas: [7] },
    });
    const { ok: _, ...cotacao } = await catalogo.consultarPreco({
      pacote: "gramado-serra-azul-3n",
      data: "2027-07-03",
      grupo: { adultos: 1, criancas: [7] },
    });

    expect(resultado).toEqual({
      ok: true,
      // 07-10 has a single Vaga, too few for two people; the 4n takes no children.
      cotacoes: [{ ...cotacao, outrasSaidas: ["2027-07-17"] }],
    });
  });

  it("mostra um Pacote com várias Saídas válidas uma vez só, com a mais barata, e as demais como alternativas", async () => {
    // 07-03 and 08-07 tie at R$ 3.000; the earlier one wins.
    expect(
      await resumo({
        destino: "Gramado",
        janela: { inicio: "2027-07-01", fim: "2027-08-31" },
        grupo: CASAL,
      }),
    ).toEqual([
      {
        pacote: "gramado-serra-azul-3n",
        data: "2027-07-03",
        total: 300000,
        outrasSaidas: ["2027-07-17", "2027-08-07"],
      },
      {
        pacote: "gramado-serra-azul-4n",
        data: "2027-07-05",
        total: 360000,
        outrasSaidas: ["2027-07-19"],
      },
    ]);
  });

  it("com mais de 10 Pacotes válidos, devolve os 10 mais baratos", async () => {
    const pacotes: Pacote[] = Array.from({ length: 12 }, (_, i) => ({
      slug: `gramado-${String(i).padStart(2, "0")}`,
      nome: `Gramado ${i}`,
      hotel: "serra-azul",
      noites: 3,
      inclui: [],
      // Pacote 11 is the cheapest, pacote 0 the most expensive.
      precoBase: 100000 + (11 - i) * 1000,
      politicaDeCriancas: { aceitaCriancas: false },
    }));
    const muitos = criarCatalogo({
      base: criarBaseEmMemoria({
        ...dados,
        pacotes,
        saidas: pacotes.map((p) => ({
          pacote: p.slug,
          data: "2027-03-06",
          vagasTotais: 10,
        })),
        periodos: [],
      }),
      relogio: relogioFixo(HOJE),
    });

    const resultado = await muitos.buscarPacotes({ grupo: { adultos: 1 } });

    expect(
      resultado.ok && resultado.cotacoes.map((c) => c.pacote.slug),
    ).toEqual([
      "gramado-11",
      "gramado-10",
      "gramado-09",
      "gramado-08",
      "gramado-07",
      "gramado-06",
      "gramado-05",
      "gramado-04",
      "gramado-03",
      "gramado-02",
    ]);
  });

  it("encontra o destino sem diferenciar maiúsculas nem acentos", async () => {
    for (const destino of [
      "florianopolis",
      "FLORIANÓPOLIS",
      " Florianópolis ",
    ]) {
      expect(
        (await resumo({ destino, janela: JULHO, grupo: CASAL })).map(
          (c) => c.pacote,
        ),
      ).toEqual(["florianopolis-lagoa-5n"]);
    }
  });

  it("sem destino, busca em todos os Destinos", async () => {
    expect(
      (await resumo({ janela: JULHO, grupo: CASAL })).map((c) => c.pacote),
    ).toEqual([
      "florianopolis-lagoa-5n",
      "gramado-serra-azul-3n",
      "gramado-serra-azul-4n",
    ]);
  });

  it("sem janela, busca de hoje até a última Saída do catálogo", async () => {
    expect(await resumo({ destino: "Florianópolis", grupo: CASAL })).toEqual([
      {
        pacote: "florianopolis-lagoa-5n",
        data: "2027-07-04",
        total: 240000,
        outrasSaidas: ["2027-12-18"],
      },
    ]);
    // 2026-11-21 has passed; 2026-12-05 is the next Saída.
    expect(
      (await resumo({ destino: "Gramado", grupo: CASAL }))[0],
    ).toMatchObject({ pacote: "gramado-serra-azul-3n", data: "2026-12-05" });
  });

  it("deixa de fora Saídas no passado mesmo dentro da janela", async () => {
    expect(
      await resumo({
        destino: "Gramado",
        janela: { inicio: "2026-11-01", fim: "2026-12-31" },
        grupo: CASAL,
      }),
    ).toEqual([
      {
        pacote: "gramado-serra-azul-3n",
        data: "2026-12-05",
        total: 300000,
        outrasSaidas: [],
      },
    ]);
  });

  it("deixa de fora Pacotes cuja Política de Crianças não aceita o Grupo, mas aceita adolescentes como adultos", async () => {
    const pacotesPara = async (criancas: number[]) =>
      (
        await resumo({
          destino: "Gramado",
          janela: JULHO,
          grupo: { adultos: 2, criancas },
        })
      ).map((c) => c.pacote);

    expect(await pacotesPara([4])).toEqual(["gramado-serra-azul-3n"]);
    expect(await pacotesPara([14])).toEqual([
      "gramado-serra-azul-3n",
      "gramado-serra-azul-4n",
    ]);
  });

  it("recusa um destino desconhecido com DESTINO_DESCONHECIDO, listando os Destinos existentes", async () => {
    expect(
      await catalogo.buscarPacotes({ destino: "Bonito", grupo: CASAL }),
    ).toEqual({
      ok: false,
      erro: "DESTINO_DESCONHECIDO",
      mensagem: expect.stringContaining("Bonito"),
      sugestoes: ["Florianópolis", "Gramado"],
    });
  });

  it("sem resultado, devolve ok com lista vazia e o diagnóstico por motivo, com o menor preço encontrado", async () => {
    // Gramado em julho para 2 adultos e uma criança de 5, até R$ 3.000: the 4n
    // takes no children (2 Saídas), the 3n on 07-10 has 1 Vaga, and the 3n
    // costs R$ 3.750 on 07-03 and R$ 5.625 on 07-17.
    expect(
      await catalogo.buscarPacotes({
        destino: "Gramado",
        janela: JULHO,
        grupo: { adultos: 2, criancas: [5] },
        orcamento: 300000,
      }),
    ).toEqual({
      ok: true,
      cotacoes: [],
      diagnostico: {
        saidasNaJanela: 5,
        foraDoOrcamento: 2,
        menorPreco: 375000,
        semVagas: 1,
        grupoNaoAceito: 2,
      },
    });
  });

  it("sem nenhuma Saída na janela, o diagnóstico diz zero e não tem menor preço", async () => {
    expect(
      await catalogo.buscarPacotes({
        destino: "Florianópolis",
        janela: { inicio: "2027-09-01", fim: "2027-09-30" },
        grupo: CASAL,
      }),
    ).toEqual({
      ok: true,
      cotacoes: [],
      diagnostico: {
        saidasNaJanela: 0,
        foraDoOrcamento: 0,
        menorPreco: null,
        semVagas: 0,
        grupoNaoAceito: 0,
      },
    });
  });

  it("recusa uma janela com início depois do fim com ENTRADA_INVALIDA", async () => {
    expect(
      await catalogo.buscarPacotes({
        janela: { inicio: "2027-07-31", fim: "2027-07-01" },
        grupo: CASAL,
      }),
    ).toMatchObject({ ok: false, erro: "ENTRADA_INVALIDA" });
  });
});
