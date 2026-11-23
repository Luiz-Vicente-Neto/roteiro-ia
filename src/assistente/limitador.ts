/**
 * Limitador: counts the Viajante's messages per chave and window, so the
 * public demo cannot burn the provider's free quota. Same design as the other
 * Bases (docs/adr/0001): the module owns the rule, storage only counts.
 */
export interface Limitador {
  /**
   * Counts one more message for `chave` in the window that starts at
   * `inicioDaJanela`, and returns how many that window has now, this one
   * included. Atomic: simultaneous calls never lose a count.
   */
  contar(chave: string, inicioDaJanela: Date): Promise<number>;
}

export function criarLimitadorEmMemoria(): Limitador {
  const contagens = new Map<string, number>();
  return {
    async contar(chave, inicioDaJanela) {
      // No await between read and write: atomic in a single event loop.
      const id = `${inicioDaJanela.toISOString()} ${chave}`;
      const contagem = (contagens.get(id) ?? 0) + 1;
      contagens.set(id, contagem);
      return contagem;
    },
  };
}

/** How many messages the Assistente takes before it refuses them with LIMITE_ATINGIDO. */
export interface Limites {
  /** Per origem (the Viajante's IP), in each clock hour. */
  porOrigemPorHora: number;
  /** For everyone together, in each day of the provider's quota. */
  globalPorDia: number;
}

const UMA_HORA_EM_MS = 60 * 60 * 1000;

/** The start of the clock hour of `agora`. */
export function inicioDaHora(agora: Date): Date {
  return new Date(
    Math.floor(agora.getTime() / UMA_HORA_EM_MS) * UMA_HORA_EM_MS,
  );
}

/** The Gemini free quota resets at midnight in this zone. */
const FUSO_DA_COTA = "America/Los_Angeles";

const partesNaCota = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO_DA_COTA,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** The wall clock of FUSO_DA_COTA at `instante`, written as if it were UTC. */
function relogioDeParede(instante: Date): number {
  const p = Object.fromEntries(
    partesNaCota
      .formatToParts(instante)
      .map(({ type, value }) => [type, Number(value)]),
  );
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) +
    instante.getUTCMilliseconds()
  );
}

/** The instant midnight of `agora`'s day was in the Pacific, where the provider's quota resets. */
export function inicioDoDiaNoPacifico(agora: Date): Date {
  const parede = relogioDeParede(agora);
  const meiaNoite = parede - (parede % (24 * UMA_HORA_EM_MS));
  // The offset at midnight, not now: a DST change at 2h moves it within the day.
  let instante = meiaNoite - (parede - agora.getTime());
  instante = meiaNoite - (relogioDeParede(new Date(instante)) - instante);
  return new Date(instante);
}

/**
 * The default global cap: about 70% of the model's daily free quota (20
 * requests, a number Google no longer publishes: check it in
 * https://aistudio.google.com/rate-limit), divided by the 2 model calls an
 * average message takes (one tool step, then the answer). The 30% left is
 * for messages that take more steps.
 */
const GLOBAL_POR_DIA_PADRAO = Math.floor((0.7 * 20) / 2);
const POR_IP_POR_HORA_PADRAO = 10;

/**
 * The Limites from LIMITE_POR_IP_HORA and LIMITE_GLOBAL_DIA, each a positive
 * integer, or its default when unset. A bad value stops the server at start.
 */
export function resolverLimites(
  env: Record<string, string | undefined>,
): Limites {
  const ler = (nome: string, padrao: number) => {
    const valor = env[nome];
    if (valor === undefined || valor === "") return padrao;
    const numero = Number(valor);
    if (!/^\d+$/.test(valor.trim()) || !(numero >= 1)) {
      throw new Error(
        `${nome} precisa ser um número inteiro maior que zero, e veio ${JSON.stringify(valor)}.`,
      );
    }
    return numero;
  };
  return {
    porOrigemPorHora: ler("LIMITE_POR_IP_HORA", POR_IP_POR_HORA_PADRAO),
    globalPorDia: ler("LIMITE_GLOBAL_DIA", GLOBAL_POR_DIA_PADRAO),
  };
}
