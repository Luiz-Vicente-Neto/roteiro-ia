import { expect, it } from "vitest";
import { recreateDatabase } from "./recreate";

it("sem Postgres no ar, diz como subir o banco em vez de só ECONNREFUSED", async () => {
  // Port 1 is never a Postgres: the connection is refused right away.
  const semServidor = "postgres://roteiro:roteiro@127.0.0.1:1/roteiro_ia_test";

  await expect(recreateDatabase(semServidor)).rejects.toThrow(
    /Postgres fora do ar em 127\.0\.0\.1:1.*pnpm db:up.*Docker/s,
  );
});
