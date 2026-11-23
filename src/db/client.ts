import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url: string) {
  // prepare: false because in production the app reaches Supabase through its
  // transaction pooler, which does not support prepared statements.
  return drizzle(postgres(url, { prepare: false, onnotice: () => {} }), {
    schema,
  });
}

export type Db = ReturnType<typeof createDb>;
