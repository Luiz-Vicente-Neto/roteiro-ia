// Drizzle schema. After editing, run `pnpm db:generate` to create the migration.
// These are storage types: the catalog module never sees them, the Postgres
// adapter (base-postgres.ts) translates them to the domain types.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

export const destinos = pgTable("destinos", {
  slug: text().primaryKey(),
  nome: text().notNull(),
});

export const hoteis = pgTable("hoteis", {
  slug: text().primaryKey(),
  nome: text().notNull(),
  destino: text()
    .notNull()
    .references(() => destinos.slug),
  aceitaPet: boolean("aceita_pet").notNull(),
});

export const pacotes = pgTable(
  "pacotes",
  {
    slug: text().primaryKey(),
    nome: text().notNull(),
    hotel: text()
      .notNull()
      .references(() => hoteis.slug),
    noites: integer().notNull(),
    inclui: text().array().notNull(),
  },
  (t) => [check("pacotes_noites_positivas", sql`${t.noites} > 0`)],
);

export const saidas = pgTable(
  "saidas",
  {
    pacote: text()
      .notNull()
      .references(() => pacotes.slug),
    // String mode: a calendar date, never shifted by a time zone.
    data: date({ mode: "string" }).notNull(),
    vagasTotais: integer("vagas_totais").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.pacote, t.data] }),
    check("saidas_vagas_nao_negativas", sql`${t.vagasTotais} >= 0`),
  ],
);
