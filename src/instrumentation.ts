/**
 * Runs once when the server starts (not during `next build`): a bad MODELO or
 * a missing key stops the server with a clear error (docs/adr/0004), instead
 * of surfacing on the first message.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resolverModelo } = await import("./assistente/modelo");
  resolverModelo(process.env);
}
