/**
 * Expected errors are values, never exceptions: the model reads `mensagem`
 * (in Portuguese) and `sugestoes` to correct its own call. Exceptions are
 * left for bugs and infrastructure failures. Codes are stable.
 */
export type CodigoDeErro =
  | "ENTRADA_INVALIDA"
  | "PACOTE_DESCONHECIDO"
  | "DESTINO_DESCONHECIDO"
  | "SAIDA_INEXISTENTE"
  | "SAIDA_ENCERRADA"
  | "GRUPO_NAO_ACEITO"
  | "VAGAS_INSUFICIENTES"
  | "PROPOSTA_INEXISTENTE"
  | "PROPOSTA_EXPIRADA"
  | "PROPOSTA_JA_CONFIRMADA"
  | "PRECO_ALTERADO";

export interface Falha<C extends CodigoDeErro = CodigoDeErro> {
  ok: false;
  erro: C;
  mensagem: string;
  sugestoes?: string[];
}

export function falha<C extends CodigoDeErro>(
  erro: C,
  mensagem: string,
  sugestoes?: string[],
): Falha<C> {
  return sugestoes
    ? { ok: false, erro, mensagem, sugestoes }
    : { ok: false, erro, mensagem };
}
