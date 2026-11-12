import { existsSync } from "node:fs";

/** The Postgres from docker-compose.yml, so a clean clone runs without a .env. */
const LOCAL_DATABASE_URL =
  "postgres://roteiro:roteiro@localhost:5432/roteiro_ia";

/** Loads `.env` into `process.env` when present. Never overrides variables already set. */
export function loadDotEnv(): void {
  if (existsSync(".env")) process.loadEnvFile(".env");
}

export function databaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.DATABASE_URL || LOCAL_DATABASE_URL;
}

/** Same server, separate database: tests never touch development data. */
export function testDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = `${parsed.pathname}_test`;
  return parsed.toString();
}
