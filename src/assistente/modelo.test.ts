import { describe, expect, it } from "vitest";
import { resolverModelo } from "./modelo";

describe("resolverModelo", () => {
  it.each([
    {
      MODELO: "google:gemini-3.8-flash",
      chave: "GOOGLE_GENERATIVE_AI_API_KEY",
      provedor: /google/,
      id: "gemini-3.8-flash",
    },
    {
      MODELO: "xai:grok-4.7",
      chave: "XAI_API_KEY",
      provedor: /xai/,
      id: "grok-4.7",
    },
    {
      MODELO: "anthropic:claude-haiku-5-5",
      chave: "ANTHROPIC_API_KEY",
      provedor: /anthropic/,
      id: "claude-haiku-5-5",
    },
    {
      MODELO: "openai:gpt-6-astra",
      chave: "OPENAI_API_KEY",
      provedor: /openai/,
      id: "gpt-6-astra",
    },
  ])(
    "resolve $MODELO com a chave em $chave",
    ({ MODELO, chave, provedor, id }) => {
      const modelo = resolverModelo({ MODELO, [chave]: "chave-de-teste" });

      expect(modelo.provider).toMatch(provedor);
      expect(modelo.modelId).toBe(id);
    },
  );

  it("mantém o que vem depois do primeiro dois-pontos como id do modelo", () => {
    const modelo = resolverModelo({
      MODELO: "openai:ft:gpt-6-astra:org:custom",
      OPENAI_API_KEY: "chave-de-teste",
    });

    expect(modelo.modelId).toBe("ft:gpt-6-astra:org:custom");
  });

  it("recusa um provedor desconhecido, listando os conhecidos, em vez de cair em outro", () => {
    expect(() =>
      resolverModelo({
        MODELO: "groq:llama-5",
        GOOGLE_GENERATIVE_AI_API_KEY: "chave-de-teste",
      }),
    ).toThrow(/provedor "groq" desconhecido.*google, xai, anthropic, openai/i);
  });

  it.each([
    "gemini-3.8-flash",
    "google:",
    ":gemini-3.8-flash",
    "google/gemini-3.8-flash",
  ])("recusa o valor malformado %j, mostrando o formato esperado", (MODELO) => {
    expect(() =>
      resolverModelo({ MODELO, GOOGLE_GENERATIVE_AI_API_KEY: "chave" }),
    ).toThrow(/provedor:modelo/);
  });

  it("recusa quando MODELO não está definido", () => {
    expect(() => resolverModelo({})).toThrow(/MODELO.*provedor:modelo/);
  });

  it("recusa quando falta a chave do provedor escolhido, mesmo havendo a de outro", () => {
    expect(() =>
      resolverModelo({
        MODELO: "xai:grok-4.7",
        GOOGLE_GENERATIVE_AI_API_KEY: "chave-de-teste",
      }),
    ).toThrow(/XAI_API_KEY/);
  });

  it("trata uma chave vazia como ausente", () => {
    expect(() =>
      resolverModelo({
        MODELO: "google:gemini-3.8-flash",
        GOOGLE_GENERATIVE_AI_API_KEY: "",
      }),
    ).toThrow(/GOOGLE_GENERATIVE_AI_API_KEY/);
  });
});
