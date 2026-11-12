// The anonymous dono of a browser's Conversas. No login and no personal data:
// just a random id in a cookie. Shared by the proxy and the server code.

export const COOKIE_DO_DONO = "dono";

/** 90 days, the same time an idle Conversa is kept. */
export const VALIDADE_DO_DONO_EM_SEGUNDOS = 90 * 24 * 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Only ids this app could have made count: anything else gets a new one. */
export function donoValido(valor: string | undefined): valor is string {
  return valor !== undefined && UUID.test(valor);
}
