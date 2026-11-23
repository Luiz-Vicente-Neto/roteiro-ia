import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url: string) {
  // prepare: false so the app also runs behind a transaction pooler (such as
  // Supabase's), which does not support prepared statements.
  return drizzle(postgres(url, { prepare: false, onnotice: () => {} }), {
    schema,
  });
}

export type Db = ReturnType<typeof createDb>;
