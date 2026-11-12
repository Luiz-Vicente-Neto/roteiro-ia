import { describe, expect, it } from "vitest";
import {
  criarBaseEmMemoria,
  criarCatalogo,
  type DadosDoCatalogo,
  type PeriodoTarifario,
  relogioFixo,
} from ".";

const HOJE = "2026-12-01T09:00:00-03:00";

const ALTA_DE_INVERNO: PeriodoTarifario = {
  nome: "Alta de Inverno",
  tipo: "temporada",
  destino: "gramado",
  inicio: "2027-07-01",
  fim: "2027-07-31",
  fator: 1.35,
};

const CORPUS_CHRISTI: PeriodoTarifario = {
  nome: "Corpus Christi",
  tipo: "feriado",
  inicio: "2027-05-24",
  fim: "2027-05-30",
  fator: 1.2,
};

const TIRADENTES: PeriodoTarifario = {
  nome: "Tiradentes",
  tipo: "feriado",
  inicio: "2027-04-17",
  fim: "2027-04-24",
  fator: 1.15,
};

// Overlaps Tiradentes in Gramado with a smaller fator, and starts first.
const PASCOA_NA_SERRA: PeriodoTarifario = {
  nome: "Páscoa na Serra",
  tipo: "temporada",
  destino: "gramado",
  inicio: "2027-04-10",
  fim: "2027-04-20",
  fator: 1.1,
};

// A small catalog built for the pricing rules: two Destinos, so a temporada
// can be shown not to leak into the other one.
const dados: DadosDoCatalogo = {
  destinos: [
    { slug: "gramado", nome: "Gramado" },
    { slug: "bonito", nome: "Bonito" },
  ],
  hoteis: [
    {
      slug: "serra-azul",
      nome: "Hotel Serra Azul",
      destino: "gramado",
      aceitaPet: false,
    },
    {
      slug: "rio-da-prata",
      nome: "Pousada Rio da Prata",
      destino: "bonito",
      aceitaPet: true,
    },
  ],
  pacotes: [
    {
      slug: "gramado-serra-azul-3n",
      nome: "Gramado Essencial no Serra Azul",
      hotel: "serra-azul",
      noites: 3,
      inclui: ["Café da manhã", "City tour"],
      precoBase: 214100,
    },
    {
      slug: "bonito-rio-da-prata-4n",
      nome: "Bonito das Águas Claras",
      hotel: "rio-da-prata",
      noites: 4,
      inclui: ["Flutuação no Rio da Prata"],
      precoBase: 300000,
    },
  ],
  saidas: [
    { pacote: "gramado-serra-azul-3n", data: "2027-03-06", vagasTotais: 20 },
    { pacote: "gramado-serra-azul-3n", data: "2027-04-17", vagasTotais: 12 },
    { pacote: "gramado-serra-azul-3n", data: "2027-07-10", vagasTotais: 3 },
    { pacote: "gramado-serra-azul-3n", data: "2027-07-24", vagasTotais: 8 },
    { pacote: "bonito-rio-da-prata-4n", data: "2027-04-24", vagasTotais: 10 },
    { pacote: "bonito-rio-da-prata-4n", data: "2027-07-10", vagasTotais: 10 },
  ],
  periodos: [ALTA_DE_INVERNO, CORPUS_CHRISTI, TIRADENTES, PASCOA_NA_SERRA],
};

const catalogo = criarCatalogo({
  base: criarBaseEmMemoria(dados),
  relogio: relogioFixo(HOJE),
});

describe("consultarPreco", () => {
  it("cobra o Preço base numa Saída fora de qualquer Período, e diz que é baixa temporada", async () => {
    const cotacao = await catalogo.consultarPreco({
      pacote: "gramado-serra-azul-3n",
      data: "2027-03-06",
      grupo: { adultos: 1 },
    });

    expect(cotacao).toEqual({
      ok: true,
      pacote: {
        slug: "gramado-serra-azul-3n",
        nome: "Gramado Essencial no Serra Azul",
        destino: { slug: "gramado", nome: "Gramado" },
        hotel: { slug: "serra-azul", nome: "Hotel Serra Azul" },
        noites: 3,
        inclui: ["Café da manhã", "City tour"],
      },
      data: "2027-03-06",
      grupo: { adultos: 1, criancas: [] },
      precoBase: 214100,
      periodoAplicado: "baixa temporada",
      fator: 1,
      periodosQuePerderam: [],
      precoPorPessoa: [{ pessoa: "adulto", preco: 214100 }],
      total: 214100,
      vagasRestantes: 20,
    });
  });

  it("aplica o fator da temporada do Destino e mostra o nome e o fator do Período", async () => {
    const cotacao = await catalogo.consultarPreco({
      pacote: "gramado-serra-azul-3n",
      data: "2027-07-24",
      grupo: { adultos: 1 },
    });

    expect(cotacao).toMatchObject({
      ok: true,
      periodoAplicado: {
        nome: "Alta de Inverno",
        tipo: "temporada",
        destino: "gramado",
        fator: 1.35,
      },
      fator: 1.35,
      periodosQuePerderam: [],
    });
  });

  it.each([
    { pacote: "gramado-serra-azul-3n", data: "2027-04-17" },
    { pacote: "bonito-rio-da-prata-4n", data: "2027-04-24" },
  ])(
    "aplica o fator de um feriado nacional a Pacotes de qualquer Destino ($pacote)",
    async ({ pacote, data }) => {
      const cotacao = await catalogo.consultarPreco({
        pacote,
        data,
        grupo: { adultos: 1 },
      });

      expect(cotacao).toMatchObject({
        ok: true,
        periodoAplicado: { nome: "Tiradentes", tipo: "feriado" },
        fator: 1.15,
      });
    },
  );

  it("com temporada e feriado sobrepostos, aplica o maior fator sem acumular e lista o Período que perdeu", async () => {
    const cotacao = await catalogo.consultarPreco({
      pacote: "gramado-serra-azul-3n",
      data: "2027-04-17",
      grupo: { adultos: 1 },
    });

    expect(cotacao).toMatchObject({
      ok: true,
      periodoAplicado: TIRADENTES,
      fator: 1.15,
      periodosQuePerderam: [PASCOA_NA_SERRA],
      // R$ 2.141 × 1,15 = R$ 2.462,15, rounded to R$ 2.462.
      total: 246200,
    });
  });

  it("arredonda o preço de adulto para reais inteiros", async () => {
    // R$ 2.141 × 1,35 = R$ 2.890,35.
    expect(
      await catalogo.consultarPreco({
        pacote: "gramado-serra-azul-3n",
        data: "2027-07-10",
        grupo: { adultos: 1 },
      }),
    ).toMatchObject({
      ok: true,
      precoPorPessoa: [{ pessoa: "adulto", preco: 289000 }],
      total: 289000,
    });
  });

  it("arredonda meio real para cima, sem erro de ponto flutuante", async () => {
    // R$ 30 × 1,15 = R$ 34,50; a float product gives 3449,9999… centavos.
    const barato = criarCatalogo({
      base: criarBaseEmMemoria({
        ...dados,
        pacotes: [{ ...dados.pacotes[0], precoBase: 3000 }],
        saidas: [dados.saidas[1]],
      }),
      relogio: relogioFixo(HOJE),
    });

    expect(
      await barato.consultarPreco({
        pacote: "gramado-serra-azul-3n",
        data: "2027-04-17",
        grupo: { adultos: 1 },
      }),
    ).toMatchObject({ ok: true, fator: 1.15, total: 3500 });
  });

  it("cobra de um Grupo de N adultos N vezes o preço de adulto, com o preço de cada pessoa", async () => {
    expect(
      await catalogo.consultarPreco({
        pacote: "gramado-serra-azul-3n",
        data: "2027-07-10",
        grupo: { adultos: 3, criancas: [] },
      }),
    ).toMatchObject({
      ok: true,
      grupo: { adultos: 3, criancas: [] },
      precoPorPessoa: [
        { pessoa: "adulto", preco: 289000 },
        { pessoa: "adulto", preco: 289000 },
        { pessoa: "adulto", preco: 289000 },
      ],
      total: 867000,
      vagasRestantes: 3,
    });
  });

  it("recusa um Pacote que não existe com PACOTE_DESCONHECIDO", async () => {
    expect(
      await catalogo.consultarPreco({
        pacote: "gramado-castelo-encantado-3n",
        data: "2027-03-06",
        grupo: { adultos: 2 },
      }),
    ).toMatchObject({ ok: false, erro: "PACOTE_DESCONHECIDO" });
  });

  it("recusa uma data que não é Saída com SAIDA_INEXISTENTE e sugere as Saídas mais próximas", async () => {
    expect(
      await catalogo.consultarPreco({
        pacote: "gramado-serra-azul-3n",
        data: "2027-07-17",
        grupo: { adultos: 2 },
      }),
    ).toMatchObject({
      ok: false,
      erro: "SAIDA_INEXISTENTE",
      sugestoes: ["2027-04-17", "2027-07-10", "2027-07-24"],
    });
  });

  it("recusa uma Saída no passado com SAIDA_ENCERRADA", async () => {
    const depois = criarCatalogo({
      base: criarBaseEmMemoria(dados),
      relogio: relogioFixo("2027-03-07T09:00:00-03:00"),
    });

    expect(
      await depois.consultarPreco({
        pacote: "gramado-serra-azul-3n",
        data: "2027-03-06",
        grupo: { adultos: 2 },
      }),
    ).toMatchObject({ ok: false, erro: "SAIDA_ENCERRADA" });
  });

  it.each([
    { caso: "sem Grupo", grupo: undefined, campo: "grupo" },
    { caso: "sem adultos", grupo: { adultos: 0 }, campo: "grupo.adultos" },
    {
      caso: "com adultos fracionados",
      grupo: { adultos: 1.5 },
      campo: "grupo.adultos",
    },
    {
      caso: "com crianças, que ainda não são cotadas",
      grupo: { adultos: 2, criancas: [7] },
      campo: "grupo.criancas",
    },
  ])(
    "recusa um Grupo $caso com ENTRADA_INVALIDA, apontando o campo",
    async ({ grupo, campo }) => {
      const resultado = await catalogo.consultarPreco({
        pacote: "gramado-serra-azul-3n",
        data: "2027-03-06",
        grupo,
      } as never);

      expect(resultado).toMatchObject({ ok: false, erro: "ENTRADA_INVALIDA" });
      expect(resultado.ok || resultado.mensagem).toContain(`${campo}:`);
    },
  );

  it("recusa uma data mal formatada com ENTRADA_INVALIDA", async () => {
    expect(
      await catalogo.consultarPreco({
        pacote: "gramado-serra-azul-3n",
        data: "06/03/2027",
        grupo: { adultos: 2 },
      }),
    ).toMatchObject({ ok: false, erro: "ENTRADA_INVALIDA" });
  });

  it("não aplica a temporada de um Destino aos Pacotes de outro Destino", async () => {
    // Bonito has no temporada of its own in this catalog.
    const cotacao = await catalogo.consultarPreco({
      pacote: "bonito-rio-da-prata-4n",
      data: "2027-07-10",
      grupo: { adultos: 1 },
    });

    expect(cotacao).toMatchObject({
      ok: true,
      periodoAplicado: "baixa temporada",
      fator: 1,
      periodosQuePerderam: [],
      total: 300000,
    });
  });
});
