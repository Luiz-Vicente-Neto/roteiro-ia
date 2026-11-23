import { generateText, type LanguageModel } from "ai";
import { semAcento } from "./caso";

/** What the juiz answered: only a yes or a no counts (docs/adr/0007). */
export type VereditoDoJuiz =
  | { recusou: true }
  | { recusou: false; motivo: string };

const INSTRUCOES = `Você confere respostas de um assistente de viagens. Leia a mensagem do usuário e a resposta do assistente e diga apenas se a resposta recusa o assunto ou diz que não tem essa informação.
Não avalie a qualidade da resposta, só isso.
Responda com uma única palavra: SIM se a resposta recusa ou diz que não tem a informação, NÃO se ela responde ao que foi pedido.`;

/**
 * Asks `modelo`, yes or no, whether `resposta` refuses the subject of
 * `mensagem` or says it does not have that information. Never a quality score.
 */
export async function perguntarAoJuiz(
  modelo: Exclude<LanguageModel, string>,
  mensagem: string,
  resposta: string,
): Promise<VereditoDoJuiz> {
  let texto: string;
  try {
    ({ text: texto } = await generateText({
      model: modelo,
      system: INSTRUCOES,
      prompt: `Mensagem do usuário:\n${mensagem}\n\nResposta do assistente:\n${resposta}`,
    }));
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro);
    return { recusou: false, motivo: `o juiz não respondeu: ${detalhe}` };
  }
  const palavra = semAcento(texto.trim()).match(/^\p{L}+/u)?.[0];
  if (palavra === "sim") return { recusou: true };
  if (palavra === "nao") return { recusou: false, motivo: "juiz: não recusou" };
  return {
    recusou: false,
    motivo: `juiz: respondeu “${texto.trim()}”, nem sim nem não`,
  };
}
