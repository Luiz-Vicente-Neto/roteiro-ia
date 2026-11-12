// Proposta: the first of the two phases of a Pré-reserva (docs/adr/0003).

/**
 * 32 bytes from a cryptographic random source, in hex: long and never
 * sequential, so nobody can guess another person's Proposta.
 */
export function gerarIdDaProposta(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
