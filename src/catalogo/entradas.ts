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
