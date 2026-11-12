import type { BaseDoCatalogo } from "./base";
import {
  type EntradaConsultarPreco,
  type EntradaVerificarDisponibilidade,
  entradaConsultarPreco,
  entradaVerificarDisponibilidade,
  validar,
} from "./entradas";
import { falha } from "./erros";
import { criarFerramentas } from "./ferramentas";
import { cotar } from "./preco";
import type { Relogio } from "./relogio";
import type { DadosDoCatalogo } from "./tipos";

const SUGESTOES_DE_SAIDA = 3;

/** ISO dates closest to `alvo` (ties go to the earlier one), returned in date order. */
function datasMaisProximas(datas: string[], alvo: string): string[] {
  const dia = (data: string) => Date.parse(`${data}T00:00:00Z`);
  const distancia = (data: string) => Math.abs(dia(data) - dia(alvo));
  return [...datas]
    .sort((a, b) => distancia(a) - distancia(b) || (a < b ? -1 : 1))
    .slice(0, SUGESTOES_DE_SAIDA)
    .sort();
}

/**
 * Finds the Saída of `entrada` in the catalog, or the error the model gets
 * when the Pacote is unknown, the date is not one of its Saídas, or it is past.
 */
function encontrarSaida(
  { pacotes, saidas }: DadosDoCatalogo,
  entrada: { pacote: string; data: string },
  hoje: string,
) {
  const pacote = pacotes.find((p) => p.slug === entrada.pacote);
  if (!pacote) {
    return falha(
      "PACOTE_DESCONHECIDO",
      `Não existe Pacote com o slug "${entrada.pacote}". Use o slug exato de um Pacote do catálogo, como aparece nos resultados de buscar_pacotes.`,
    );
  }
  const doPacote = saidas.filter((s) => s.pacote === entrada.pacote);
  const proximas = datasMaisProximas(
    doPacote.filter((s) => s.data >= hoje).map((s) => s.data),
    entrada.data,
  );
  const saida = doPacote.find((s) => s.data === entrada.data);
  if (saida && saida.data < hoje) {
    return falha(
      "SAIDA_ENCERRADA",
      `A Saída de ${entrada.data} do Pacote "${entrada.pacote}" já aconteceu (hoje é ${hoje}). Ofereça uma Saída futura; as mais próximas estão em sugestoes.`,
      proximas,
    );
  }
  if (!saida) {
    return falha(
      "SAIDA_INEXISTENTE",
      proximas.length > 0
        ? `O Pacote "${entrada.pacote}" não tem Saída em ${entrada.data}. As Saídas mais próximas estão em sugestoes; use uma delas.`
        : `O Pacote "${entrada.pacote}" não tem Saída em ${entrada.data}, nem nenhuma outra Saída futura.`,
      proximas,
    );
  }
  return { ok: true as const, pacote, saida };
}

export function criarCatalogo({
  base,
  relogio,
}: {
  base: BaseDoCatalogo;
  relogio: Relogio;
}) {
  const operacoes = {
    async verificarDisponibilidade(bruta: EntradaVerificarDisponibilidade) {
      const validacao = validar(entradaVerificarDisponibilidade, bruta);
      if (!validacao.ok) return validacao;
      const encontrada = encontrarSaida(
        await base.lerCatalogo(),
        validacao.valor,
        relogio.hoje(),
      );
      if (!encontrada.ok) return encontrada;
      const { saida } = encontrada;
      return {
        ok: true as const,
        pacote: saida.pacote,
        data: saida.data,
        vagasTotais: saida.vagasTotais,
        // Equal to the total until Pré-reservas exist (#9) and are subtracted.
        vagasRestantes: saida.vagasTotais,
      };
    },

    async consultarPreco(bruta: EntradaConsultarPreco) {
      const validacao = validar(entradaConsultarPreco, bruta);
      if (!validacao.ok) return validacao;
      const entrada = validacao.valor;
      const catalogo = await base.lerCatalogo();
      const encontrada = encontrarSaida(catalogo, entrada, relogio.hoje());
      if (!encontrada.ok) return encontrada;
      return cotar(
        catalogo,
        encontrada.pacote,
        encontrada.saida,
        entrada.grupo,
      );
    },
  };
  return { ...operacoes, ferramentas: criarFerramentas(operacoes) };
}
