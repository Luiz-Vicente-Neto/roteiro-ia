/** Injected clock, so tests and the evaluation fix "today" and "now". */
export interface Relogio {
  agora(): Date;
  /** Today's calendar date in São Paulo, `YYYY-MM-DD`. */
  hoje(): string;
}

// en-CA formats dates as YYYY-MM-DD.
const dataEmSaoPaulo = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function criarRelogio(agora: () => Date): Relogio {
  return {
    agora,
    hoje: () => dataEmSaoPaulo.format(agora()),
  };
}

export function relogioDoSistema(): Relogio {
  return criarRelogio(() => new Date());
}

/** A clock stopped at `instante` (anything `new Date` accepts, e.g. `2026-12-01T09:00:00-03:00`). */
export function relogioFixo(instante: string | Date): Relogio {
  const fixo = new Date(instante);
  if (Number.isNaN(fixo.getTime())) {
    throw new Error(`Instante inválido para o relógio: ${String(instante)}`);
  }
  return criarRelogio(() => new Date(fixo));
}
