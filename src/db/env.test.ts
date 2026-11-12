import { describe, expect, it } from "vitest";
import { databaseUrl, testDatabaseUrl } from "./env";

describe("databaseUrl", () => {
  it("usa DATABASE_URL quando definida", () => {
    expect(
      databaseUrl({ DATABASE_URL: "postgres://u:p@db.exemplo:6543/prod" }),
    ).toBe("postgres://u:p@db.exemplo:6543/prod");
  });

  it("cai no Postgres do docker compose quando DATABASE_URL não existe, para um clone limpo rodar sem .env", () => {
    expect(databaseUrl({})).toBe(
      "postgres://roteiro:roteiro@localhost:5432/roteiro_ia",
    );
  });
});

describe("testDatabaseUrl", () => {
  it("aponta para um banco separado com sufixo _test no mesmo servidor", () => {
    expect(
      testDatabaseUrl("postgres://roteiro:roteiro@localhost:5432/roteiro_ia"),
    ).toBe("postgres://roteiro:roteiro@localhost:5432/roteiro_ia_test");
  });
});
