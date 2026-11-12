import { z } from "zod";
import { type Falha, falha } from "./erros";

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
      // Children are priced by the Política de Crianças (#5); until then the
      // list must be empty, so no child is ever quoted at an adult's price.
      criancas: z
        .array(z.number().int().min(0))
        .max(
          0,
          "Por enquanto só é possível cotar Grupos de adultos; envie criancas como lista vazia.",
        )
        .default([])
        .describe("Idade de cada criança, em anos."),
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
