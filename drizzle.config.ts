import { defineConfig } from "drizzle-kit";
import { databaseUrl, loadDotEnv } from "./src/db/env";

loadDotEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrl() },
});
