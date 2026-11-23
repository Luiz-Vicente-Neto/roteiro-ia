import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ResultadoDoCaso, ResultadosDaAvaliacao } from "./avaliar";

/**
 * The results kept in `arquivo`, one JSON per line, appended as each Caso
 * ends, so a run stopped halfway keeps what it had. The file is local and
 * out of Git (.gitignore); a missing one holds no result.
 */
export function resultadosEmArquivo(arquivo: string): ResultadosDaAvaliacao {
  return {
    async ler() {
      let texto: string;
      try {
        texto = await readFile(arquivo, "utf8");
      } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw erro;
      }
      return texto
        .split("\n")
        .filter((linha) => linha.trim() !== "")
        .map((linha) => {
          const lido = JSON.parse(linha) as ResultadoDoCaso;
          return { ...lido, rodouEm: new Date(lido.rodouEm) };
        });
    },
    async gravar(resultado) {
      await mkdir(dirname(arquivo), { recursive: true });
      await appendFile(arquivo, `${JSON.stringify(resultado)}\n`);
    },
  };
}
