import { sql } from "drizzle-orm";
import { afterAll, expect, inject, it } from "vitest";
import { createDb } from "./client";

const db = createDb(inject("databaseUrl"));

afterAll(() => db.$client.end());

it("as migrations deixam a extensão pgvector habilitada", async () => {
  const [{ distancia }] = await db.execute<{ distancia: number }>(
    sql`select '[1,2,3]'::vector <-> '[1,2,5]'::vector as distancia`,
  );

  expect(distancia).toBe(2);
});
