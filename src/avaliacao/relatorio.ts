import type { Relatorio } from "./avaliar";
import type { Categoria } from "./caso";

/** How the Relatório names each category. */
const NOME_DA_CATEGORIA: Record<Categoria, string> = { preco: "preço" };

const DATA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
});

/** The Relatório as Markdown: the table goes to the README as is. */
export function relatorioEmMarkdown(relatorio: Relatorio): string {
  const veredito = relatorio.aprovada ? "**Aprovada.**" : "**Reprovada.**";
  const linhas = [
    "# Avaliação do Assistente",
    "",
    `${veredito} Modelo \`${relatorio.modelo}\`, em ${DATA.format(relatorio.geradoEm)}.`,
    "",
    "| Categoria | Acertos | Total | % | Piso |",
    "| --- | --: | --: | --: | --: |",
    ...relatorio.categorias.map(
      (c) =>
        `| ${NOME_DA_CATEGORIA[c.categoria]} | ${c.acertos} | ${c.total} | ${c.percentual}% ${c.aprovada ? "✓" : "✗"} | ${c.piso}% |`,
    ),
    "",
    relatorio.valoresInventados.length === 0
      ? "Tolerância zero: nenhum Valor inventado ✓"
      : `Tolerância zero: ✗ ${relatorio.valoresInventados
          .map(
            ({ caso, valores }) =>
              `Valor inventado em \`${caso}\` (${valores.map((v) => v.texto).join(", ")})`,
          )
          .join("; ")}`,
    "",
  ];
  if (relatorio.reprovados.length > 0) {
    linhas.push(
      "## Casos reprovados",
      "",
      ...relatorio.reprovados.map(
        ({ caso, motivos }) => `- \`${caso}\`: ${motivos.join("; ")}`,
      ),
      "",
    );
  }
  return linhas.join("\n");
}
