import type { TestProject } from "vitest/node";
import { databaseUrl, loadDotEnv, testDatabaseUrl } from "./env";
import { migrateDatabase } from "./migrate";
import { recreateDatabase } from "./recreate";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** Every `pnpm test:db` run starts from a freshly migrated, empty test database. */
export default async function setup(project: TestProject) {
  loadDotEnv();
  const url = testDatabaseUrl(databaseUrl());
  await recreateDatabase(url);
  await migrateDatabase(url);
  project.provide("databaseUrl", url);
}
