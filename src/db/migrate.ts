import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client";

export async function migrateDatabase(url: string): Promise<void> {
  const db = createDb(url);
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
  } finally {
    await db.$client.end();
  }
}
