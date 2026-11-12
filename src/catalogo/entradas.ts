import { z } from "zod";
import { type Falha, falha } from "./erros";
import { IDADE_ADULTA } from "./grupo";

// Messages are written for the model to fix its own call.
const INFORME_O_PACOTE =
  "Informe o slug do Pacote, como gramado-serra-azul-3n.";

const slugDoPacote = z
  .string({ error: INFORME_O_PACOTE })
  .min(1, INFORME_O_PACOTE)
  .describe(
    "Slug do Pacote, como aparece no catálogo (ex.: gramado-serra-azul-3n).",
  );

const dataDaSaida = z.iso
  .date({
    error:
      "Use uma data de calendário real no formato AAAA-MM-DD, sem hora (ex.: 2027-01-09).",
  })
  .describe("Data da Saída no formato AAAA-MM-DD (ex.: 2027-01-09).");

export const entradaVerificarDisponibilidade = z.object({
  pacote: slugDoPacote,
  data: dataDaSaida,
});

export type EntradaVerificarDisponibilidade = z.input<
  typeof entradaVerificarDisponibilidade
>;

const grupo = z
  .object(
    {
      adultos: z
        .number({ error: "Informe o número de adultos, como 2." })
        .int("O número de adultos é inteiro.")
        .min(1, "O Grupo precisa de pelo menos 1 adulto."),
      criancas: z
        .array(
          z
            .number({ error: "Cada idade é um número de anos, como 7." })
            .int("Cada idade é um número inteiro de anos.")
            .min(0, "Uma idade não pode ser negativa.")
            .max(
              17,
              "Só informe em criancas quem tem até 17 anos; de 18 em diante, some em adultos.",
            ),
        )
        .default([])
        .describe(
          `Idade de cada criança, em anos inteiros (0 a 17). De ${IDADE_ADULTA} anos em diante, a pessoa paga como adulto.`,
        ),
    },
    { error: "Informe o Grupo, como { adultos: 2, criancas: [] }." },
  )
  .describe("Quem viaja: número de adultos e a idade de cada criança.");

/** Grupo: who travels, as the operations receive it after validation. */
export type Grupo = z.output<typeof grupo>;

export const entradaConsultarPreco = z.object({
  pacote: slugDoPacote,
  data: dataDaSaida,
  grupo,
});

export type EntradaConsultarPreco = z.input<typeof entradaConsultarPreco>;

/** Proposing takes exactly what quoting takes, and is validated the same way. */
export const entradaProporPreReserva = entradaConsultarPreco;

export type EntradaProporPreReserva = EntradaConsultarPreco;

const dataDaJanela = z.iso.date({
  error:
    "Use uma data de calendário real no formato AAAA-MM-DD, sem hora (ex.: 2027-07-01).",
});

export const entradaBuscarPacotes = z.object({
  grupo,
  destino: z
    .string({ error: "O destino é o nome de um Destino, como Gramado." })
    .trim()
    .min(1, "Informe o nome do Destino, ou omita destino para buscar em todos.")
    .optional()
    .describe(
      "Nome do Destino (ex.: Gramado). Maiúsculas e acentos não importam. Omita para buscar em todos os Destinos.",
    ),
  janela: z
    .object(
      {
        inicio: dataDaJanela.describe(
          "Primeiro dia em que a Saída pode começar, AAAA-MM-DD, inclusive.",
        ),
        fim: dataDaJanela.describe(
          "Último dia em que a Saída pode começar, AAAA-MM-DD, inclusive.",
        ),
      },
      { error: "A janela é { inicio, fim }, com datas AAAA-MM-DD." },
    )
    .refine((j) => j.inicio <= j.fim, {
      error: "O início da janela não pode ser depois do fim.",
    })
    .optional()
    .describe(
      "Datas em que a Saída pode começar. Omita para buscar de hoje até a última Saída do catálogo.",
    ),
  orcamento: z
    .number({ error: "O orçamento é um valor em centavos, como 400000." })
    .int("O orçamento é um número inteiro de centavos.")
    .positive("O orçamento precisa ser maior que zero.")
    .optional()
    .describe(
      "Valor máximo do TOTAL do Grupo (não por pessoa), em centavos: R$ 4.000 é 400000. Omita se não houver limite.",
    ),
});

export type EntradaBuscarPacotes = z.input<typeof entradaBuscarPacotes>;

/** Validates `entrada`, turning schema violations into an ENTRADA_INVALIDA value. */
export function validar<S extends z.ZodType>(
  schema: S,
  entrada: unknown,
): { ok: true; valor: z.output<S> } | Falha<"ENTRADA_INVALIDA"> {
  const resultado = schema.safeParse(entrada);
  if (resultado.success) return { ok: true, valor: resultado.data };
  const problemas = resultado.error.issues.map(
    (issue) => `${issue.path.join(".") || "entrada"}: ${issue.message}`,
  );
  return falha(
    "ENTRADA_INVALIDA",
    `Entrada inválida. Corrija e chame de novo. ${problemas.join(" ")}`,
  );
}
