import { describe, expect, it } from "vitest";
import { criarBaseEmMemoria, semente } from ".";
import type { PeriodoTarifario, Saida } from "./tipos";

const { destinos, hoteis, pacotes, saidas, periodos } = semente;

const feriados = periodos.filter((p) => p.tipo === "feriado");

const cobre = (periodo: PeriodoTarifario, data: string) =>
  periodo.inicio <= data && data <= periodo.fim;

const destinoDoHotel = (hotel: string) =>
  hoteis.find((h) => h.slug === hotel)?.destino;

const destinoDaSaida = (saida: Saida) =>
  destinoDoHotel(pacotes.find((p) => p.slug === saida.pacote)?.hotel ?? "");

/** Days between two ISO dates. */
const diasEntre = (a: string, b: string) =>
  (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;

describe("semente", () => {
  it("tem os 7 Destinos da demo", () => {
    expect(destinos.map((d) => d.nome).sort()).toEqual([
      "Bonito",
      "Campos do Jordão",
      "Foz do Iguaçu",
      "Gramado",
      "Jericoacoara",
      "Lençóis Maranhenses",
      "Porto de Galinhas",
    ]);
  });

  it("é aceita pela Base em memória, que confere fatores e Políticas de Crianças", () => {
    expect(() => criarBaseEmMemoria(semente)).not.toThrow();
  });

  it("só referencia Destinos, Hotéis e Pacotes que existem, e não repete slugs", () => {
    const slugs = (lista: { slug: string }[]) =>
      new Set(lista.map((x) => x.slug));
    const deDestino = slugs(destinos);
    const deHotel = slugs(hoteis);
    const dePacote = slugs(pacotes);

    expect(deDestino.size).toBe(destinos.length);
    expect(deHotel.size).toBe(hoteis.length);
    expect(dePacote.size).toBe(pacotes.length);
    expect(hoteis.filter((h) => !deDestino.has(h.destino))).toEqual([]);
    expect(pacotes.filter((p) => !deHotel.has(p.hotel))).toEqual([]);
    expect(saidas.filter((s) => !dePacote.has(s.pacote))).toEqual([]);
    expect(
      periodos.filter(
        (p) => p.tipo === "temporada" && !deDestino.has(p.destino),
      ),
    ).toEqual([]);
  });

  it("tem Períodos que terminam no dia em que começam ou depois", () => {
    expect(periodos.filter((p) => p.fim < p.inicio)).toEqual([]);
  });

  it("tem cerca de 40 Pacotes terrestres, com mais de uma duração em cada Destino", () => {
    expect(pacotes.length).toBeGreaterThanOrEqual(35);
    expect(pacotes.length).toBeLessThanOrEqual(45);
    expect(
      pacotes.flatMap((p) => p.inclui).filter((item) => /aére|voo/i.test(item)),
    ).toEqual([]);
    for (const destino of destinos) {
      const duracoes = new Set(
        pacotes
          .filter((p) => destinoDoHotel(p.hotel) === destino.slug)
          .map((p) => p.noites),
      );
      expect(duracoes.size, destino.slug).toBeGreaterThan(1);
    }
  });

  it("tem 2 ou 3 Políticas de Crianças, uma delas sem crianças, e Hotéis com e sem pet", () => {
    const politicas = new Set(
      pacotes.map((p) => JSON.stringify(p.politicaDeCriancas)),
    );

    expect(politicas.size).toBeGreaterThanOrEqual(2);
    expect(politicas.size).toBeLessThanOrEqual(3);
    expect(pacotes.some((p) => !p.politicaDeCriancas.aceitaCriancas)).toBe(
      true,
    );
    expect(hoteis.some((h) => h.aceitaPet)).toBe(true);
    expect(hoteis.some((h) => !h.aceitaPet)).toBe(true);
  });

  it("dá a cada Pacote uma Saída por semana de janeiro a dezembro de 2027, sem repetir data", () => {
    for (const pacote of pacotes) {
      const datas = saidas
        .filter((s) => s.pacote === pacote.slug)
        .map((s) => s.data)
        .sort();

      expect(datas[0] <= "2027-01-07", pacote.slug).toBe(true);
      expect(datas[datas.length - 1] >= "2027-12-25", pacote.slug).toBe(true);
      expect(
        datas.slice(1).filter((data, i) => diasEntre(datas[i], data) !== 7),
        pacote.slug,
      ).toEqual([]);
    }
    expect(saidas.filter((s) => !s.data.startsWith("2027-"))).toEqual([]);
  });

  it("tem Saídas com poucas Vagas e quantidades variadas", () => {
    const vagas = new Set(saidas.map((s) => s.vagasTotais));

    expect(saidas.filter((s) => s.vagasTotais <= 3).length).toBeGreaterThan(0);
    expect(vagas.size).toBeGreaterThan(5);
  });

  it.each([
    "2027-01-01",
    "2027-02-08",
    "2027-02-09",
    "2027-03-26",
    "2027-04-21",
    "2027-05-01",
    "2027-05-27",
    "2027-09-07",
    "2027-10-12",
    "2027-11-02",
    "2027-11-15",
    "2027-11-20",
    "2027-12-25",
  ])("tem um feriado nacional que cobre %s", (dia) => {
    expect(feriados.some((f) => cobre(f, dia))).toBe(true);
  });

  it.each([
    { feriado: "Sexta-feira Santa", dentro: "2027-03-27", fora: "2027-03-20" },
    { feriado: "Corpus Christi", dentro: "2027-05-29", fora: "2027-05-22" },
    { feriado: "Carnaval", dentro: "2027-02-06", fora: "2027-01-30" },
  ])(
    "cobre com $feriado a Saída de sábado do feriadão ($dentro), não a da semana anterior ($fora)",
    ({ feriado, dentro, fora }) => {
      const periodo = feriados.find((f) => f.nome === feriado);
      if (!periodo) throw new Error(`Feriado ${feriado} não está na semente`);

      expect(cobre(periodo, dentro)).toBe(true);
      expect(cobre(periodo, fora)).toBe(false);
    },
  );

  it("dá a cada Pacote uma Saída na janela de cada feriado de 2027", () => {
    const feriadosDe2027 = feriados.filter(
      (f) => f.inicio >= "2027-01-01" && f.fim <= "2027-12-31",
    );
    for (const feriado of feriadosDe2027) {
      for (const pacote of pacotes) {
        expect(
          saidas.some(
            (s) => s.pacote === pacote.slug && cobre(feriado, s.data),
          ),
          `${feriado.nome} em ${pacote.slug}`,
        ).toBe(true);
      }
    }
  });

  it("tem uma Saída coberta ao mesmo tempo por uma temporada do seu Destino e por um feriado", () => {
    const coberta = saidas.find(
      (s) =>
        feriados.some((f) => cobre(f, s.data)) &&
        periodos.some(
          (p) =>
            p.tipo === "temporada" &&
            p.destino === destinoDaSaida(s) &&
            cobre(p, s.data),
        ),
    );

    expect(coberta).toBeDefined();
  });

  it("tem temporadas altas em todos os Destinos", () => {
    const comTemporada = new Set(
      periodos.flatMap((p) => (p.tipo === "temporada" ? [p.destino] : [])),
    );

    expect([...comTemporada].sort()).toEqual(
      destinos.map((d) => d.slug).sort(),
    );
  });
});
