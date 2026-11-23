/**
 * Requests per minute the free Gemini Flash tier takes (docs/adr/0004): at
 * most one call every 12 seconds.
 */
const RPM_PADRAO = 5;

/** The model's requests per minute, from AVALIACAO_RPM (default 5). */
export function resolverRpm(env: Record<string, string | undefined>): number {
  const valor = env.AVALIACAO_RPM;
  if (valor === undefined || valor === "") return RPM_PADRAO;
  if (!/^\d+$/.test(valor.trim()) || !(Number(valor) >= 1)) {
    throw new Error(
      `AVALIACAO_RPM precisa ser um número inteiro maior que zero, e veio ${JSON.stringify(valor)}.`,
    );
  }
  return Number(valor);
}
