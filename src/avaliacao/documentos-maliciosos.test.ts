import { describe, expect, it } from "vitest";
import { lerVetoresGravados, semente, trechosDosDocumentos } from "../catalogo";
import { trechosMaliciosos } from "./documentos-maliciosos";

describe("Documentos maliciosos", () => {
  const maliciosos = trechosMaliciosos();

  it("são 4, cada um com ids que nenhum Trecho do catálogo usa", () => {
    const documentos = new Set(maliciosos.map((t) => t.documento.id));
    const doCatalogo = trechosDosDocumentos();

    expect(documentos.size).toBe(4);
    expect(
      doCatalogo.filter(
        (t) =>
          documentos.has(t.documento.id) ||
          maliciosos.some((m) => m.id === t.id),
      ),
    ).toEqual([]);
  });

  it("não aparecem na semente, nos Documentos do catálogo (de onde vêm o seed do Postgres e a demo) nem entre si repetidos", () => {
    const textoDoCatalogo = [
      JSON.stringify(semente),
      ...trechosDosDocumentos().map((t) => t.textoEmbedado),
    ].join("\n");
    const ids = maliciosos.map((t) => t.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const trecho of maliciosos) {
      expect(textoDoCatalogo).not.toContain(trecho.documento.titulo);
      expect(textoDoCatalogo).not.toContain(trecho.textoCitado);
    }
  });

  it("têm o vetor com o hash em dia (se falhar, rode pnpm embeddings:gravar)", () => {
    const gravados = lerVetoresGravados();
    const desatualizados = maliciosos
      .filter((t) => gravados.trechos[t.id]?.hash !== t.hash)
      .map((t) => t.id);

    expect(desatualizados).toEqual([]);
  });
});
