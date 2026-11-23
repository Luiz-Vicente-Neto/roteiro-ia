import type { UIMessage } from "ai";
import {
  type Chamada,
  chamadasDaResposta,
  textoDaMensagem,
} from "../assistente";

/**
 * A price or a number of Vagas in an answer's text that no Ferramenta
 * returned in the Conversa. `texto` is how the answer wrote it.
 */
export type ValorInventado =
  | { tipo: "preco"; texto: string; centavos: number }
  | { tipo: "vagas"; texto: string; vagas: number };

/** A number written in pt-BR: thousands with dots, centavos after a comma, maybe "mil". */
const VALOR = String.raw`(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?(?:\s*(mil)\b)?`;

/** "R$ 4.282,00", "R$4.282", "R$ 3 mil", or "4.282 reais". */
const PRECO = new RegExp(
  String.raw`R\$\s*${VALOR}|(?<![\d.,])${VALOR}\s+reais\b`,
  "giu",
);

/**
 * "3 vagas", "20 Vagas", or "Vagas restantes: 3" (one word, or none,
 * before the colon). The number must stand
 * alone, so the year of "23/01/2027 vagas" never counts; a period after
 * it may end the sentence.
 */
const VAGAS =
  /(?<![\d.,/-])(\d+)\s+vagas?\b|\bvagas?(?:\s+\p{L}+)?\s*:\s*(\d+)(?![\d,/-]|\.\d)/giu;

/** The values the Ferramentas returned, by kind. */
interface Devolvidos {
  centavos: Set<number>;
  vagas: Set<number>;
}

/**
 * The Valores inventados of `resposta`: every price in reais and every
 * number next to "vaga" or "vagas" in its text must equal a value some
 * Ferramenta returned in `conversa` up to `resposta` (the whole Conversa, or
 * the messages before it), or in `resposta` itself. Dates of Saída are left
 * out, because the Viajante writes dates too. In the order of the text.
 *
 * Only the catalog's structured values count, never the text of a Trecho:
 * a Documento is not where a price comes from, so one that states a price
 * cannot make the Assistente's copy of it pass.
 */
export function valoresInventados(
  resposta: UIMessage,
  conversa: UIMessage[],
): ValorInventado[] {
  const devolvidos = valoresDevolvidos(chamadasAte(resposta, conversa));
  const texto = textoDaMensagem(resposta);
  const achados: (ValorInventado & { posicao: number })[] = [];
  for (const m of texto.matchAll(PRECO)) {
    // Groups 1 to 3 are the "R$" form, 4 to 6 the "reais" one.
    const [inteiro, decimais, mil] = m[1] ? m.slice(1, 4) : m.slice(4, 7);
    const centavos = emCentavos(inteiro ?? "", decimais, mil !== undefined);
    if (!devolvidos.centavos.has(centavos)) {
      achados.push({ tipo: "preco", texto: m[0], centavos, posicao: m.index });
    }
  }
  for (const m of texto.matchAll(VAGAS)) {
    const vagas = Number(m[1] ?? m[2]);
    if (!devolvidos.vagas.has(vagas)) {
      achados.push({ tipo: "vagas", texto: m[0], vagas, posicao: m.index });
    }
  }
  return achados
    .sort((a, b) => a.posicao - b.posicao)
    .map(({ posicao: _, ...valor }) => valor);
}

/** "4.282" and "00" → 428200; with "mil", "3" → 300000. */
function emCentavos(
  inteiro: string,
  decimais: string | undefined,
  mil: boolean,
): number {
  const reais = Number(`${inteiro.replaceAll(".", "")}.${decimais ?? "0"}`);
  return Math.round(reais * 100 * (mil ? 1000 : 1));
}

/** The tool calls of `conversa` up to `resposta`, and of `resposta` itself. */
function chamadasAte(resposta: UIMessage, conversa: UIMessage[]): Chamada[] {
  const ate = conversa.findIndex((m) => m.id === resposta.id);
  const lidas = [...(ate === -1 ? conversa : conversa.slice(0, ate)), resposta];
  return lidas.flatMap(chamadasDaResposta);
}

/**
 * Money is every number under the key `preco` (of each person) or `total`,
 * in centavos: never `precoBase`, which comes before Período and discounts
 * and no one pays. Vagas, every number under a key starting with `vagas`.
 * Only calls that worked: a refusal's numbers are in its mensagem, whose
 * wording is not stable.
 */
function valoresDevolvidos(chamadas: Chamada[]): Devolvidos {
  const devolvidos: Devolvidos = { centavos: new Set(), vagas: new Set() };
  const visitar = (valor: unknown, chave: string): void => {
    if (typeof valor === "number") {
      if (chave === "preco" || chave === "total") {
        devolvidos.centavos.add(valor);
      }
      if (chave.startsWith("vagas")) devolvidos.vagas.add(valor);
    } else if (Array.isArray(valor)) {
      for (const item of valor) visitar(item, chave);
    } else if (typeof valor === "object" && valor !== null) {
      for (const [k, v] of Object.entries(valor)) visitar(v, k);
    }
  };
  for (const chamada of chamadas) {
    if (chamada.ok) visitar(chamada.saida, "");
  }
  return devolvidos;
}
