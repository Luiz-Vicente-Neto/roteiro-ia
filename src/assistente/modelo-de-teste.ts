// A scripted fake model for tests: each step either calls a tool or answers
// in text. Used by the Assistente's tests and the Avaliação's.
import {
  convertArrayToReadableStream,
  type MockLanguageModelV4,
} from "ai/test";

/** One scripted model step, as `MockLanguageModelV4`'s `doStream` takes it. */
export type RespostaRoteirizada = ConstructorParameters<
  typeof MockLanguageModelV4
>[0] extends infer O
  ? O extends { doStream?: infer D }
    ? Exclude<D, unknown[] | ((...args: never[]) => unknown)>
    : never
  : never;

const uso = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

/** One model step that answers with `conteudo`, in two deltas to show streaming. */
export function passoDeTexto(conteudo: string): RespostaRoteirizada {
  const meio = Math.floor(conteudo.length / 2);
  return {
    stream: convertArrayToReadableStream([
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: conteudo.slice(0, meio) },
      { type: "text-delta", id: "t1", delta: conteudo.slice(meio) },
      { type: "text-end", id: "t1" },
      {
        type: "finish",
        finishReason: { unified: "stop", raw: undefined },
        usage: uso,
      },
    ]),
  };
}

/** One model step that calls the tool `nome` with `entrada`, as the call `id`. */
export function passoDeChamada(
  nome: string,
  entrada: unknown,
  id: string = crypto.randomUUID(),
): RespostaRoteirizada {
  return {
    stream: convertArrayToReadableStream([
      {
        type: "tool-call",
        toolCallId: id,
        toolName: nome,
        input: JSON.stringify(entrada),
      },
      {
        type: "finish",
        finishReason: { unified: "tool-calls", raw: undefined },
        usage: uso,
      },
    ]),
  };
}
