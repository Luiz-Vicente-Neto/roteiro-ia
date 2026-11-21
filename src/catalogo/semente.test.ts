import { describe, expect, it } from "vitest";
import {
  criarBaseEmMemoria,
  criarCatalogo,
  lerVetoresGravados,
  PERGUNTAS_GRAVADAS,
  relogioFixo,
  semente,
  trechosDosDocumentos,
} from ".";
import { buscaNosTextosDeTeste } from "./textos-de-teste";
import type { PeriodoTarifario, Saida } from "./tipos";

const { destinos, hoteis, pacotes, saidas, periodos } = semente;

const feriados = periodos.filter((p) => p.tipo === "feriado");

const cobre = (periodo: PeriodoTarifario, data: string) =>
  periodo.inicio <= data && data <= periodo.fim;

const destinoDoHotel = (hotel: string) =>
  hoteis.find((h) => h.slug === hotel)?.destino;

const destinoDaSaida = (saida: Saida) =>
  destinoDoHotel(pacotes.find((p) => p.slug === saida.pacote)?.hotel ?? "");

/** Hotéis in which every Pacote has the Política de Crianças without children. */
const hoteisSoParaAdultos = hoteis
  .filter((h) => {
    const doHotel = pacotes.filter((p) => p.hotel === h.slug);
    return (
      doHotel.length > 0 &&
      doHotel.every((p) => !p.politicaDeCriancas.aceitaCriancas)
    );
  })
  .map((h) => h.slug);

/** Things only a Hotel that takes children has. */
const estruturaInfantil =
  /certid(?:ão|ões)|documentos? d[aeo]s? (?:crianças?|menor(?:es)?)|\b(?:área|piscina|espaço|clube|recreação|cardápio|menu)s? (?:infantil|infantis|kids)\b|kids club|brinquedoteca|berços?\b/i;

/** The one way such a Hotel may mention children: saying it does not take them. */
const naoRecebeCriancas =
  /\bnão (?:recebe|aceita|hospeda)m?\b[^.!?]*\bcrianças?\b/i;

/**
 * The sentences of `texto` that contradict a Hotel only for adults: one with
 * child-only structure or papers, or one about children that is not a refusal.
 * "Crianças até 5 anos não pagam" has a "não" and still says the Hotel takes them.
 */
function contradizSoAdultos(texto: string): string[] {
  return texto
    .split(/(?<=[.!?])\s+/)
    .filter(
      (frase) =>
        estruturaInfantil.test(frase) ||
        (/\bcrianças?\b/i.test(frase) && !naoRecebeCriancas.test(frase)),
    );
}

/** What people call a feriado, and the name of its Período in the seed. */
const NOME_OFICIAL_DO_APELIDO: Record<string, string> = {
  Réveillon: "Confraternização Universal",
  "Ano-Novo": "Confraternização Universal",
  "Ano Novo": "Confraternização Universal",
  Páscoa: "Sexta-feira Santa",
  "Semana Santa": "Sexta-feira Santa",
};

const escaparRegex = (texto: string) =>
  texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const regexDoApelido = (apelido: string) =>
  new RegExp(`\\b${escaparRegex(apelido)}(?![\\p{L}-])`, "giu");

/**
 * The feriado nicknames in `texto` that do not sit in parentheses right after
 * the name of their own Período: "Confraternização Universal (o Ano-Novo)"
 * passes, "Carnaval (o Réveillon)" does not.
 */
function apelidosDeFeriado(texto: string): string[] {
  return Object.entries(NOME_OFICIAL_DO_APELIDO).flatMap(([apelido, nome]) => {
    const explicado = new RegExp(
      `${escaparRegex(nome)} \\([^)]*\\b${escaparRegex(apelido)}[^)]*\\)`,
      "giu",
    );
    return texto.replace(explicado, "").match(regexDoApelido(apelido)) ?? [];
  });
}

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

  // The question shown in the README, in the chat placeholder and in the
  // buscar_pacotes description. Whoever types it in the demo must see cards,
  // so a seed change that empties this search has to change the example too.
  it('traz Cotações para a pergunta de exemplo "4 dias em Gramado em julho, casal, até R$ 6 mil"', async () => {
    // Asked before the Saídas start, "julho" is the July of the seed's year.
    const catalogo = criarCatalogo({
      ...buscaNosTextosDeTeste(),
      base: criarBaseEmMemoria(semente),
      relogio: relogioFixo("2026-12-01T09:00:00-03:00"),
    });

    const resultado = await catalogo.buscarPacotes({
      destino: "Gramado",
      janela: { inicio: "2027-07-01", fim: "2027-07-31" },
      grupo: { adultos: 2 },
      orcamento: 600000,
    });
    if (!resultado.ok) throw new Error(resultado.mensagem);

    // "4 dias" are 3 noites: one of the cards has to be a trip of that length.
    expect(resultado.cotacoes.map((c) => c.pacote.noites)).toContain(3);
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

describe("Trechos dos Documentos", () => {
  const trechos = trechosDosDocumentos();

  it("quebram a Política da Agência em um Trecho por seção, com id estável", () => {
    expect(
      trechos
        .filter((t) => t.documento.id === "politica-da-agencia")
        .map((t) => t.id),
    ).toEqual([
      "politica-da-agencia#cancelamento",
      "politica-da-agencia#pagamento",
      "politica-da-agencia#documentos-de-viagem",
      "politica-da-agencia#o-que-a-pre-reserva-garante",
      "politica-da-agencia#criancas",
      "politica-da-agencia#pets",
    ]);
  });

  const doHotel = (slug: string) => trechos.filter((t) => t.hotel === slug);

  it("dão uma Descrição a cada Destino, ligada só ao Destino", () => {
    for (const destino of destinos) {
      const descricao = trechos.filter(
        (t) => t.tipoDoDocumento === "destino" && t.destino === destino.slug,
      );

      expect(descricao.length, destino.slug).toBeGreaterThan(0);
      expect(descricao[0].documento, destino.slug).toEqual({
        id: `destino-${destino.slug}`,
        titulo: destino.nome,
      });
      expect(descricao.filter((t) => t.hotel !== undefined)).toEqual([]);
    }
  });

  it("dão uma Descrição a cada Hotel, ligada ao Hotel e ao Destino dele", () => {
    for (const hotel of hoteis) {
      const descricao = doHotel(hotel.slug);

      expect(descricao.length, hotel.slug).toBeGreaterThan(0);
      for (const trecho of descricao) {
        expect(trecho, trecho.id).toMatchObject({
          tipoDoDocumento: "hotel",
          documento: { id: `hotel-${hotel.slug}`, titulo: hotel.nome },
          destino: hotel.destino,
        });
      }
    }
  });

  it("deixam a Política da Agência sem Destino nem Hotel: ela vale para todos", () => {
    const daPolitica = trechos.filter(
      (t) => t.tipoDoDocumento === "politica-da-agencia",
    );

    expect(daPolitica.length).toBeGreaterThan(0);
    expect(
      daPolitica.filter(
        (t) => t.destino !== undefined || t.hotel !== undefined,
      ),
    ).toEqual([]);
  });

  const faqs = trechos.filter((t) => t.tipoDoDocumento === "faq");

  it("têm cerca de 20 FAQs, gerais e de Destino, sem Hotel", () => {
    expect(faqs.length).toBeGreaterThanOrEqual(18);
    expect(faqs.length).toBeLessThanOrEqual(26);
    expect(faqs.some((t) => t.destino === undefined)).toBe(true);
    expect(faqs.some((t) => t.destino !== undefined)).toBe(true);
    expect(faqs.filter((t) => t.hotel !== undefined)).toEqual([]);
  });

  it("fazem de cada pergunta da FAQ um Trecho, com o id derivado da pergunta e a pergunta no texto embedado", () => {
    const passaporte = trechos.find(
      (t) => t.id === "faq-geral#preciso-de-passaporte-para-viajar",
    );

    expect(passaporte).toMatchObject({
      documento: { id: "faq-geral", titulo: "Perguntas frequentes" },
      tipoDoDocumento: "faq",
      secao: "Preciso de passaporte para viajar?",
    });
    expect(passaporte?.destino).toBeUndefined();
    expect(passaporte?.textoEmbedado).toBe(
      `Perguntas frequentes › Preciso de passaporte para viajar?\n\n${passaporte?.textoCitado}`,
    );
    for (const faq of faqs) {
      expect(faq.secao, faq.id).toMatch(/\?$/);
    }
  });

  it("ligam a FAQ de um Destino ao Destino, com o nome dele no título", () => {
    const deBonito = trechos.filter(
      (t) => t.tipoDoDocumento === "faq" && t.destino === "bonito",
    );

    expect(deBonito.length).toBeGreaterThan(0);
    for (const trecho of deBonito) {
      expect(trecho.documento, trecho.id).toEqual({
        id: "faq-bonito",
        titulo: "Perguntas frequentes sobre Bonito",
      });
      expect(trecho.textoEmbedado, trecho.id).toMatch(
        /^Perguntas frequentes sobre Bonito › /,
      );
    }
  });

  it("embedam o Trecho de um Hotel com o nome do Hotel e do Destino no prefixo", () => {
    const [primeiro] = doHotel("serra-azul");

    expect(primeiro.textoEmbedado).toBe(
      `Hotel Serra Azul, Gramado › ${primeiro.secao}\n\n${primeiro.textoCitado}`,
    );
  });

  it("dão a todo Hotel que aceita pet uma seção de pets com porte, taxa e áreas", () => {
    for (const hotel of hoteis.filter((h) => h.aceitaPet)) {
      const pets = trechos.find((t) => t.id === `hotel-${hotel.slug}#pets`);

      expect(pets, hotel.slug).toBeDefined();
      expect(pets?.textoCitado, hotel.slug).toMatch(/porte/i);
      expect(pets?.textoCitado, hotel.slug).toMatch(/taxa/i);
      expect(pets?.textoCitado, hotel.slug).toMatch(/áreas?/i);
      expect(pets?.textoCitado, hotel.slug).not.toMatch(/não aceita/i);
    }
  });

  it("nunca dizem que um Hotel sem pet aceita animais, nem na Descrição dele nem em outro Documento que o cite", () => {
    // "aceita pets", "aceitamos animais"... unless right after a "não".
    const aceita =
      /(?<!não )\baceita(?:m|mos)?\s+(?:pets?|animais|cães|cachorros?|gatos?)/i;
    for (const hotel of hoteis.filter((h) => !h.aceitaPet)) {
      const dizQueAceita = trechos.filter(
        (t) =>
          (t.hotel === hotel.slug || t.textoCitado.includes(hotel.nome)) &&
          aceita.test(t.textoCitado),
      );

      expect(
        dizQueAceita.map((t) => t.id),
        hotel.slug,
      ).toEqual([]);
      const pets = trechos.find((t) => t.id === `hotel-${hotel.slug}#pets`);
      if (pets) expect(pets.textoCitado, hotel.slug).toMatch(/não aceita/i);
    }
  });

  describe("de um Hotel só para adultos", () => {
    it("reprovam certidão e estrutura infantil, e aceitam dizer que o Hotel não recebe crianças", () => {
      expect(
        contradizSoAdultos(
          "No check-in, apresente a certidão de nascimento das crianças.",
        ),
      ).not.toEqual([]);
      expect(contradizSoAdultos("Há berço sob pedido.")).not.toEqual([]);
      expect(contradizSoAdultos("Crianças até 5 anos não pagam.")).not.toEqual(
        [],
      );
      expect(contradizSoAdultos("Leve o documento do menor.")).not.toEqual([]);
      expect(contradizSoAdultos("A piscina infantil é aquecida.")).not.toEqual(
        [],
      );
      expect(contradizSoAdultos("O clube infantil abre às 9h.")).not.toEqual(
        [],
      );
      expect(
        contradizSoAdultos(
          "Tem spa e piscina aquecida. O Hotel não recebe crianças.",
        ),
      ).toEqual([]);
    });

    it("só citam crianças para dizer que o Hotel não as recebe", () => {
      expect(hoteisSoParaAdultos.length).toBeGreaterThan(0);
      for (const hotel of hoteisSoParaAdultos) {
        const contradicoes = trechos
          .filter((t) => t.hotel === hotel)
          .flatMap((t) =>
            contradizSoAdultos(t.textoCitado).map(
              (frase) => `${t.id}: ${frase}`,
            ),
          );

        expect(contradicoes, hotel).toEqual([]);
      }
    });
  });

  describe("de Hotel e de FAQ", () => {
    it("ligam cada apelido ao nome de um feriado da semente", () => {
      const nomes = new Set(feriados.map((f) => f.nome));

      expect(
        Object.values(NOME_OFICIAL_DO_APELIDO).filter((n) => !nomes.has(n)),
      ).toEqual([]);
    });

    it("reprovam apelido de feriado, e aceitam o apelido entre parênteses depois do nome do Período", () => {
      expect(
        apelidosDeFeriado("As Saídas do Réveillon não têm reembolso."),
      ).toEqual(["Réveillon"]);
      expect(apelidosDeFeriado("Na Páscoa, o Hotel lota.")).toEqual(["Páscoa"]);
      expect(apelidosDeFeriado("A Semana Santa tem tarifa própria.")).toEqual([
        "Semana Santa",
      ]);
      expect(apelidosDeFeriado("No Carnaval (o Réveillon), lota.")).toEqual([
        "Réveillon",
      ]);
      expect(
        apelidosDeFeriado(
          "As Saídas de Confraternização Universal (o Ano-Novo) não têm reembolso.",
        ),
      ).toEqual([]);
    });

    it("só citam feriados pelo nome de um Período da semente", () => {
      const comApelido = trechos
        .filter(
          (t) => t.tipoDoDocumento === "hotel" || t.tipoDoDocumento === "faq",
        )
        .flatMap((t) =>
          apelidosDeFeriado(t.textoCitado).map(
            (apelido) => `${t.id}: ${apelido}`,
          ),
        );

      expect(comApelido).toEqual([]);
    });
  });

  it("nunca trazem valor em reais, número de Vagas nem data de Saída", () => {
    const meses =
      "janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";
    const proibido = new RegExp(
      `R\\$|\\breais\\b|\\b\\d+\\s+vagas?\\b|\\d{4}-\\d{2}-\\d{2}|\\b\\d{1,2}/\\d{1,2}\\b|\\b\\d{1,2}º? de (?:${meses})`,
      "i",
    );

    expect(
      trechos.filter((t) => proibido.test(t.textoCitado)).map((t) => t.id),
    ).toEqual([]);
  });

  it("cabem no limite de tamanho de um Trecho (cerca de 400 tokens)", () => {
    expect(
      trechos.filter((t) => t.textoEmbedado.length > 1600).map((t) => t.id),
    ).toEqual([]);
  });

  it("têm ids únicos", () => {
    const ids = trechos.map((t) => t.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("embedam o texto com o prefixo de origem e citam o texto limpo", () => {
    const cancelamento = trechos.find(
      (t) => t.id === "politica-da-agencia#cancelamento",
    );

    expect(cancelamento).toMatchObject({
      documento: { id: "politica-da-agencia", titulo: "Política da Agência" },
      tipoDoDocumento: "politica-da-agencia",
      secao: "Cancelamento",
    });
    expect(cancelamento?.textoCitado).toMatch(/^Você pode cancelar a viagem/);
    expect(cancelamento?.textoCitado).not.toMatch(/##|Política da Agência ›/);
    expect(cancelamento?.textoEmbedado).toBe(
      `Política da Agência › Cancelamento\n\n${cancelamento?.textoCitado}`,
    );
  });
});

describe("vetores gravados", () => {
  const gravados = lerVetoresGravados();

  it("são do modelo padrão de EMBEDDINGS, com 768 dimensões", () => {
    expect(gravados.modelo).toBe("google:gemini-embedding-2");
    expect(gravados.dimensoes).toBe(768);
  });

  it("têm um vetor com o hash em dia para cada Trecho (se falhar, rode pnpm embeddings:gravar)", () => {
    const desatualizados = trechosDosDocumentos()
      .filter((t) => gravados.trechos[t.id]?.hash !== t.hash)
      .map((t) => t.id);

    expect(desatualizados).toEqual([]);
  });

  it("têm o vetor de cada pergunta usada nos testes, todos com 768 dimensões", () => {
    expect(Object.keys(gravados.perguntas).sort()).toEqual(
      [...PERGUNTAS_GRAVADAS].sort(),
    );
    const vetores = [
      ...Object.values(gravados.perguntas),
      ...Object.values(gravados.trechos).map((t) => t.vetor),
    ];
    expect(vetores.filter((v) => v.length !== 768)).toEqual([]);
  });
});
