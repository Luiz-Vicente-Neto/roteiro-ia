// Pré-reserva: the second of the two phases (docs/adr/0003).

/** No 0/O or 1/I, so the code reads the same aloud and on paper. */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A short, readable code like `RT-K7QM`, from a cryptographic random source. */
export function gerarCodigoDaPreReserva(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  // 256 is a multiple of the 32 letters, so every letter is equally likely.
  return `RT-${Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("")}`;
}
